# Afrowatch Ad System - Detailed Implementation Plan

## System Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Advertisers   │────>│  Ad Management   │────>│   Ad Server     │
│     Portal      │     │     API          │     │   (Storage)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           │
┌─────────────────┐     ┌──────────────────┐            │
│   Video.js      │<────│  Ad Insertion    │<───────────┘
│   Player        │     │     Logic        │
└─────────────────┘     └──────────────────┘
        │                        │
        │                        │
        v                        v
┌─────────────────┐     ┌──────────────────┐
│   Mux API       │     │   Analytics      │
│   (Views)       │     │   Tracking       │
└─────────────────┘     └──────────────────┘
```

## Phase 1: Database Schema Design

### DynamoDB Tables

**Table: Ads**
```javascript
{
  PK: "AD#",
  SK: "AD#",
  adId: "uuid",
  advertiserId: "uuid",
  advertiserName: "string",
  title: "string",
  description: "string",
  videoUrl: "string", // S3 or Mux URL
  thumbnailUrl: "string",
  duration: number, // seconds
  clickThroughUrl: "string",
  status: "pending|approved|active|paused|rejected",
  
  // Targeting
  targetAgeRange: ["18-24", "25-34"],
  targetGender: ["all", "male", "female"],
  targetCountries: ["US", "NG", "GH"],
  targetContentCategories: ["drama", "comedy"],
  
  // Campaign details
  campaignType: "cpm|cpc|flat", // Cost per thousand, cost per click, flat rate
  budget: number,
  spent: number,
  maxImpressions: number,
  currentImpressions: number,
  
  // Scheduling
  startDate: "ISO timestamp",
  endDate: "ISO timestamp",
  
  createdAt: "ISO timestamp",
  updatedAt: "ISO timestamp",
  
  // GSI indexes
  GSI1PK: "STATUS#",
  GSI1SK: "DATE#",
  GSI2PK: "ADVERTISER#",
  GSI2SK: "DATE#"
}
```

**Table: AdCampaigns**
```javascript
{
  PK: "CAMPAIGN#",
  SK: "CAMPAIGN#",
  campaignId: "uuid",
  advertiserId: "uuid",
  name: "string",
  totalBudget: number,
  spent: number,
  status: "active|paused|completed",
  adIds: ["adId1", "adId2"],
  startDate: "ISO timestamp",
  endDate: "ISO timestamp",
  createdAt: "ISO timestamp"
}
```

**Table: AdImpressions**
```javascript
{
  PK: "IMPRESSION##", // date format: YYYY-MM-DD
  SK: "IMPRESSION##",
  impressionId: "uuid",
  adId: "uuid",
  userId: "uuid",
  contentId: "uuid", // which video was playing
  timestamp: "ISO timestamp",
  completed: boolean, // did they watch the full ad
  completionPercentage: number,
  skipped: boolean,
  skipTime: number, // seconds before skip
  userAgent: "string",
  ipAddress: "string", // hashed for privacy
  country: "string",
  
  // GSI for daily aggregations
  GSI1PK: "AD#",
  GSI1SK: "DATE#"
}
```

**Table: AdClicks**
```javascript
{
  PK: "CLICK##",
  SK: "CLICK##",
  clickId: "uuid",
  adId: "uuid",
  impressionId: "uuid",
  userId: "uuid",
  timestamp: "ISO timestamp",
  clickThroughUrl: "string"
}
```

### MongoDB Collections

**Collection: advertisers**
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // reference to users collection
  companyName: "string",
  businessType: "string",
  contactEmail: "string",
  contactPhone: "string",
  website: "string",
  stripeCustomerId: "string",
  paymentMethods: [{
    paymentMethodId: "string",
    type: "card",
    last4: "string",
    default: boolean
  }],
  billing: {
    address: "string",
    city: "string",
    country: "string",
    taxId: "string"
  },
  status: "pending|approved|active|suspended",
  totalSpent: number,
  accountBalance: number, // prepaid balance
  createdAt: Date,
  updatedAt: Date
}
```

**Collection: adTransactions**
```javascript
{
  _id: ObjectId,
  advertiserId: ObjectId,
  campaignId: "string",
  type: "charge|refund|credit",
  amount: number,
  currency: "USD",
  description: "string",
  stripePaymentIntentId: "string",
  status: "pending|succeeded|failed",
  createdAt: Date
}
```

## Phase 2: Backend API Design

### API Endpoints Structure

**Advertiser Management**
```
POST   /api/advertisers/register
GET    /api/advertisers/profile
PUT    /api/advertisers/profile
POST   /api/advertisers/payment-methods
DELETE /api/advertisers/payment-methods/:id
GET    /api/advertisers/billing-history
```

**Ad Management**
```
POST   /api/ads                    // Create new ad
GET    /api/ads                    // Get advertiser's ads
GET    /api/ads/:adId              // Get specific ad
PUT    /api/ads/:adId              // Update ad
DELETE /api/ads/:adId              // Delete ad
POST   /api/ads/:adId/upload-video // Upload ad video
GET    /api/ads/:adId/analytics    // Get ad performance
```

**Campaign Management**
```
POST   /api/campaigns              // Create campaign
GET    /api/campaigns              // Get all campaigns
GET    /api/campaigns/:id          // Get campaign details
PUT    /api/campaigns/:id          // Update campaign
POST   /api/campaigns/:id/pause    // Pause campaign
POST   /api/campaigns/:id/resume   // Resume campaign
```

**Ad Serving (Public API)**
```
GET    /api/ad-server/get-ad       // Request ad for viewer
POST   /api/ad-server/impression   // Track impression
POST   /api/ad-server/complete     // Track completion
POST   /api/ad-server/click        // Track click
POST   /api/ad-server/skip         // Track skip
```

**Admin Endpoints**
```
GET    /api/admin/ads/pending      // Ads awaiting approval
POST   /api/admin/ads/:id/approve  // Approve ad
POST   /api/admin/ads/:id/reject   // Reject ad
GET    /api/admin/advertisers      // All advertisers
PUT    /api/admin/advertisers/:id  // Update advertiser status
```

### Key API Implementation Examples

**Ad Selection Algorithm (Node.js/Express)**
```javascript
// /api/ad-server/get-ad
async function selectAd(req, res) {
  const { userId, contentId, contentCategory, country } = req.body;
  
  // Get user demographics from MongoDB
  const user = await User.findById(userId);
  
  // Query eligible ads from DynamoDB
  const eligibleAds = await queryEligibleAds({
    contentCategory,
    country,
    userAge: calculateAge(user.dateOfBirth),
    userGender: user.gender
  });
  
  // Filter by budget and schedule
  const activeAds = eligibleAds.filter(ad => {
    const now = Date.now();
    return ad.status === 'active' &&
           ad.spent < ad.budget &&
           ad.currentImpressions < ad.maxImpressions &&
           new Date(ad.startDate) <= now &&
           new Date(ad.endDate) >= now;
  });
  
  // Weighted selection based on bid/priority
  const selectedAd = weightedRandomSelection(activeAds);
  
  // Generate impression ID for tracking
  const impressionId = generateUUID();
  
  return res.json({
    impressionId,
    ad: {
      adId: selectedAd.adId,
      videoUrl: selectedAd.videoUrl,
      duration: selectedAd.duration,
      clickThroughUrl: selectedAd.clickThroughUrl,
      skipEnabled: selectedAd.skipEnabled,
      skipAfterSeconds: selectedAd.skipAfterSeconds
    }
  });
}
```

**Impression Tracking**
```javascript
// /api/ad-server/impression
async function trackImpression(req, res) {
  const { impressionId, adId, userId, contentId } = req.body;
  
  // Record impression in DynamoDB
  await dynamoDB.put({
    TableName: 'AdImpressions',
    Item: {
      PK: `IMPRESSION#${adId}#${getTodayDate()}`,
      SK: `IMPRESSION#${Date.now()}#${userId}`,
      impressionId,
      adId,
      userId,
      contentId,
      timestamp: new Date().toISOString(),
      completed: false,
      completionPercentage: 0,
      skipped: false
    }
  }).promise();
  
  // Increment impression count (atomic counter)
  await dynamoDB.update({
    TableName: 'Ads',
    Key: { PK: `AD#${advertiserId}`, SK: `AD#${adId}` },
    UpdateExpression: 'ADD currentImpressions :inc',
    ExpressionAttributeValues: { ':inc': 1 }
  }).promise();
  
  res.json({ success: true });
}
```

**Billing Integration with Stripe**
```javascript
// Charge advertiser when budget threshold reached
async function chargeAdvertiser(advertiserId, amount) {
  const advertiser = await Advertiser.findById(advertiserId);
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      customer: advertiser.stripeCustomerId,
      payment_method: advertiser.paymentMethods.find(pm => pm.default).paymentMethodId,
      off_session: true,
      confirm: true,
      description: `Ad spend for ${new Date().toLocaleDateString()}`
    });
    
    // Record transaction
    await AdTransaction.create({
      advertiserId,
      type: 'charge',
      amount,
      stripePaymentIntentId: paymentIntent.id,
      status: 'succeeded',
      description: 'Daily ad spend charge'
    });
    
    return paymentIntent;
  } catch (error) {
    // Handle failed payment - pause campaigns
    await pauseAdvertiserCampaigns(advertiserId);
    // Send notification email
    await sendPaymentFailedEmail(advertiser.contactEmail);
  }
}
```

## Phase 3: Video.js Integration

### Video.js IMA Plugin Setup

```javascript
// Install required packages
npm install video.js
npm install videojs-ima
```

### React Component with Ads

```jsx
import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'videojs-ima';
import 'video.js/dist/video-js.css';
import 'videojs-ima/dist/videojs.ima.css';

const AfrowatchPlayer = ({ contentId, videoUrl, onViewTracked }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [adData, setAdData] = useState(null);

  useEffect(() => {
    // Fetch ad for this content
    const fetchAd = async () => {
      const response = await fetch('/api/ad-server/get-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          userId: getCurrentUserId(),
          contentCategory: getContentCategory(contentId),
          country: getUserCountry()
        })
      });
      const data = await response.json();
      setAdData(data);
    };

    fetchAd();
  }, [contentId]);

  useEffect(() => {
    if (!videoRef.current || !adData) return;

    // Initialize Video.js player
    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true
    });

    playerRef.current = player;

    // Configure IMA plugin for ads
    player.ima({
      adTagUrl: createVASTUrl(adData),
      disableCustomPlaybackForIOS10Plus: true
    });

    // Track impression when ad starts
    player.ima.addEventListener(
      google.ima.AdEvent.Type.STARTED,
      () => {
        trackAdImpression(adData.impressionId, adData.ad.adId);
      }
    );

    // Track completion
    player.ima.addEventListener(
      google.ima.AdEvent.Type.COMPLETE,
      () => {
        trackAdComplete(adData.impressionId, adData.ad.adId);
      }
    );

    // Track skips
    player.ima.addEventListener(
      google.ima.AdEvent.Type.SKIPPED,
      (event) => {
        trackAdSkip(adData.impressionId, adData.ad.adId, event.getAdData().currentTime);
      }
    );

    // Track clicks
    player.ima.addEventListener(
      google.ima.AdEvent.Type.CLICK,
      () => {
        trackAdClick(adData.impressionId, adData.ad.adId);
      }
    );

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
      }
    };
  }, [adData]);

  return (
    
      
        
      
    
  );
};

// Helper functions
function createVASTUrl(adData) {
  // Create VAST XML URL for the ad
  return `/api/ad-server/vast/${adData.impressionId}`;
}

async function trackAdImpression(impressionId, adId) {
  await fetch('/api/ad-server/impression', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impressionId, adId, userId: getCurrentUserId() })
  });
}

async function trackAdComplete(impressionId, adId) {
  await fetch('/api/ad-server/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impressionId, adId, completed: true })
  });
}

async function trackAdSkip(impressionId, adId, skipTime) {
  await fetch('/api/ad-server/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impressionId, adId, skipTime })
  });
}

async function trackAdClick(impressionId, adId) {
  await fetch('/api/ad-server/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impressionId, adId })
  });
}
```

### VAST XML Generation

```javascript
// Server endpoint: /api/ad-server/vast/:impressionId
function generateVAST(ad, impressionId) {
  return `

  
    
      Afrowatch Ad System
      ${ad.title}
      <![CDATA[https://afrowatch.com/api/ad-server/impression?id=${impressionId}]]>
      
        
          
            ${formatDuration(ad.duration)}
            
              <![CDATA[https://afrowatch.com/api/ad-server/track?event=start&id=${impressionId}]]>
              <![CDATA[https://afrowatch.com/api/ad-server/track?event=q1&id=${impressionId}]]>
              <![CDATA[https://afrowatch.com/api/ad-server/track?event=mid&id=${impressionId}]]>
              <![CDATA[https://afrowatch.com/api/ad-server/track?event=q3&id=${impressionId}]]>
              <![CDATA[https://afrowatch.com/api/ad-server/track?event=complete&id=${impressionId}]]>
            
            
              <![CDATA[${ad.clickThroughUrl}]]>
              <![CDATA[https://afrowatch.com/api/ad-server/click?id=${impressionId}]]>
            
            
              
                <![CDATA[${ad.videoUrl}]]>
              
            
          
        
      
    
  
`;
}
```

## Phase 4: Advertiser Portal UI

### React Components Structure

```
src/
├── pages/
│   ├── advertiser/
│   │   ├── Dashboard.jsx
│   │   ├── CreateAd.jsx
│   │   ├── Campaigns.jsx
│   │   ├── Analytics.jsx
│   │   └── Billing.jsx
├── components/
│   ├── ads/
│   │   ├── AdForm.jsx
│   │   ├── AdPreview.jsx
│   │   ├── AdUploader.jsx
│   │   └── TargetingOptions.jsx
│   ├── analytics/
│   │   ├── PerformanceChart.jsx
│   │   ├── MetricsCard.jsx
│   │   └── ReportExport.jsx
```

### Dashboard Component Example

```jsx
import React, { useEffect, useState } from 'react';

const AdvertiserDashboard = () => {
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const response = await fetch('/api/advertisers/dashboard');
    const data = await response.json();
    setStats(data.stats);
    setCampaigns(data.campaigns);
  };

  return (
    
      Advertiser Dashboard
      
      
        
        
        
        
      

      
        Active Campaigns
        
      
    
  );
};
```

## Phase 5: Analytics & Reporting

### Analytics Aggregation Service

```javascript
// Run daily to aggregate stats
async function aggregateDailyStats() {
  const yesterday = getYesterdayDate();
  
  // Get all ads that had impressions yesterday
  const ads = await getAllAdsWithImpressions(yesterday);
  
  for (const ad of ads) {
    const impressions = await getImpressions(ad.adId, yesterday);
    const clicks = await getClicks(ad.adId, yesterday);
    
    const stats = {
      date: yesterday,
      adId: ad.adId,
      totalImpressions: impressions.length,
      completedViews: impressions.filter(i => i.completed).length,
      skippedViews: impressions.filter(i => i.skipped).length,
      averageCompletionRate: calculateAvgCompletion(impressions),
      totalClicks: clicks.length,
      ctr: (clicks.length / impressions.length) * 100,
      costPerImpression: ad.campaignType === 'cpm' ? (ad.budget / 1000) : 0,
      totalCost: calculateDailyCost(ad, impressions, clicks)
    };
    
    // Store aggregated stats
    await storeAggregatedStats(stats);
    
    // Update ad spend
    await updateAdSpend(ad.adId, stats.totalCost);
    
    // Charge advertiser if needed
    if (shouldChargeAdvertiser(ad.advertiserId)) {
      await chargeAdvertiser(ad.advertiserId, stats.totalCost);
    }
  }
}
```

### Real-time Analytics API

```javascript
// GET /api/ads/:adId/analytics
async function getAdAnalytics(req, res) {
  const { adId } = req.params;
  const { startDate, endDate } = req.query;
  
  const analytics = await queryAnalytics(adId, startDate, endDate);
  
  return res.json({
    overview: {
      totalImpressions: analytics.totalImpressions,
      completedViews: analytics.completedViews,
      averageCompletion: analytics.avgCompletionRate,
      clicks: analytics.totalClicks,
      ctr: analytics.ctr,
      spent: analytics.totalSpent
    },
    timeline: analytics.dailyBreakdown,
    demographics: {
      ageGroups: analytics.byAge,
      genders: analytics.byGender,
      countries: analytics.byCountry
    },
    performance: {
      topPerformingContent: analytics.topContent,
      peakHours: analytics.hourlyDistribution
    }
  });
}
```

## Phase 6: Admin Review System

### Admin Portal for Ad Approval

```jsx
const AdApprovalQueue = () => {
  const [pendingAds, setPendingAds] = useState([]);

  const approveAd = async (adId) => {
    await fetch(`/api/admin/ads/${adId}/approve`, { method: 'POST' });
    // Refresh list
  };

  const rejectAd = async (adId, reason) => {
    await fetch(`/api/admin/ads/${adId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  };

  return (
    
      {pendingAds.map(ad => (
        <AdReviewCard 
          key={ad.adId}
          ad={ad}
          onApprove={() => approveAd(ad.adId)}
          onReject={(reason) => rejectAd(ad.adId, reason)}
        />
      ))}
    
  );
};
```

## Phase 7: Pricing Models Implementation

### CPM (Cost Per Mille - per 1000 impressions)
```javascript
function calculateCPMCost(impressions, cpmRate) {
  return (impressions / 1000) * cpmRate;
}
```

### CPC (Cost Per Click)
```javascript
function calculateCPCCost(clicks, cpcRate) {
  return clicks * cpcRate;
}
```

### Flat Rate
```javascript
function calculateFlatRateCost(daysActive, dailyRate) {
  return daysActive * dailyRate;
}
```