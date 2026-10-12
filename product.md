# Product Discovery Background

> This document preserves the original discovery and product direction. `PROJECT.md` is the authoritative source of truth for the agreed MVP scope, domain rules, workflows, and implementation constraints. Where the documents differ, follow `PROJECT.md` and the accepted ADRs in `docs/decisions/`.

## 1. Product Overview

### Working Product Concept

A digital marketplace and value-routing platform for unused, outdated, damaged, and end-of-life electronics.

The platform helps owners determine what their devices may still be worth and connects them with businesses or individuals who can reuse, repair, refurbish, salvage, resell, or recycle those items.

Instead of immediately treating an unwanted electronic device as junk, the platform helps answer:

> **What is this device still worth, and where should it go next?**

The long-term vision may expand beyond consumer electronics into larger electrical devices and appliances such as printers, televisions, refrigerators, washing machines, air conditioners, office equipment, and similar products.

---

# 2. Problem Statement

Households, businesses, and institutions already have access to traditional disposal channels such as junk shops.

However, traditional junk shops commonly offer a flat or weight-based exchange that does not necessarily reflect the remaining value of an electronic device.

A device may still have value through:

- Direct resale
- Repair
- Refurbishment
- Component reuse
- Parts harvesting
- Material recovery
- Donation
- Recycling

Because owners often do not know which option is appropriate or how much value remains in their equipment, they may:

- Keep unused devices for long periods
- Dispose of potentially valuable equipment as scrap
- Accept significantly less than an item's possible value
- Delay disposal because they are uncertain what to do
- Fail to connect with people or businesses that could still use the device

The core problem is therefore not simply a lack of disposal access.

The deeper problem is:

> **Owners lack an easy way to evaluate the remaining value of unwanted electronics and route them toward the most appropriate next use.**

---

# 3. Problem Discovery

Initial assumptions focused on creating a convenient e-waste collection or disposal system.

Customer interviews challenged this assumption.

Interviewees generally already had access to junk shops or other disposal channels.

The recurring problem was uncertainty about whether equipment still had value before it was disposed of.

Electronic technicians naturally perform this evaluation because they understand which devices and components may still be useful.

Households and general businesses usually do not have the same knowledge.

Institutions may perform their own evaluation and transfer processes but can experience additional delays because of internal procedures and asset-disposal requirements.

The discovery process therefore shifted the product direction from:

> **Help people dispose of electronics.**

to:

> **Help people understand what their electronics are worth and connect them with the right destination before disposal.**

---

# 4. Product Vision

Build a platform where unwanted electronics are treated as potentially valuable assets before they are treated as waste.

The platform should enable an item's lifecycle to become:

```text
Unused / Broken Electronic
          |
          v
     Item Evaluation
          |
          v
   Marketplace Listing
          |
          v
  Interested Buyers
          |
    +-----+------+----------+
    |            |          |
    v            v          v
 Resale       Repair     Salvage
    |            |          |
    +------------+----------+
                 |
                 v
             Recycling
            when necessary
```

The platform should encourage:

> **Reuse first. Repair when possible. Recover parts when useful. Recycle when necessary.**

---

# 5. Product Mission

Reduce unnecessary electronic waste by making it easier for owners to discover the remaining value of electronics and connect those items with people or businesses that can give them another useful purpose.

---

# 6. Value Proposition

## For Electronics Owners

> **Know what your old electronics may be worth before treating them as junk.**

Users can list unwanted electronics and receive interest or offers from businesses that may value the item differently.

Instead of having only one disposal option, owners can compare possible routes.

---

## For Refurbishers and Repair Businesses

> **Find electronics worth repairing, refurbishing, or using for parts.**

Businesses gain access to a local source of unused and damaged electronics.

---

## For Junk Shops and Recyclers

> **Discover electronic equipment that has reached the end of its usable life and can be recovered responsibly.**

The platform does not replace junk shops.

Instead, junk shops become one possible destination in a larger value-recovery network.

---

# 7. Target Users

The platform is a two-sided marketplace.

## 7.1 Supply Side

People and organizations that own unwanted electronics.

### Primary MVP Users

- Households
- Students
- Individual consumers
- Small businesses
- Private offices

### Future Users

- Schools
- Universities
- Large companies
- Government institutions
- Organizations with large inventories of equipment

Institutional workflows should not initially be the main MVP focus because they may involve additional approval, accounting, procurement, bidding, or asset-disposal requirements.

---

## 7.2 Demand Side

People and businesses that obtain value from unwanted electronics.

Potential buyers include:

- Electronics technicians
- Computer repair shops
- Mobile repair shops
- Appliance repair businesses
- Refurbishers
- Second-hand electronics sellers
- Parts resellers
- Electronics recyclers
- Junk shops
- Independent repair technicians

---

# 8. Core Product Hypothesis

The primary hypothesis is:

> **Owners of unused electronics will be more willing to release those electronics if they can see their potential remaining value and compare multiple possible buyers instead of immediately accepting a flat junk-shop price.**

The marketplace-side hypothesis is:

> **Repair shops, refurbishers, technicians, resellers, recyclers, and junk shops will use the platform if it provides a convenient source of electronics relevant to their businesses.**

Both hypotheses must be validated.

---

# 9. Core Product Principles

## 9.1 Value Before Disposal

The system should not immediately classify unwanted electronics as waste.

It should first determine whether the item may be:

- Reusable
- Repairable
- Refurbishable
- Resellable
- Salvageable
- Recyclable

---

## 9.2 Marketplace-Driven Valuation

The MVP should not attempt to perfectly calculate the monetary value of every device.

Instead, real buyers should help determine value through offers.

For example:

```text
Old Laptop Listing

Repair Shop A       -> ₱1,500
Parts Reseller B    -> ₱1,200
Refurbisher C       -> ₱1,800
Junk Shop D         -> ₱500
```

The owner can then compare options.

---

## 9.3 Disposal Is the Last Route

The platform should prioritize higher-value uses before material disposal whenever practical.

Example routing:

```text
Functional
   |
   +--> Resale / Reuse

Damaged but Repairable
   |
   +--> Technician / Refurbisher

Not Repairable but Useful for Parts
   |
   +--> Salvage / Parts Buyer

No Practical Reuse Value
   |
   +--> Recycler / Junk Shop
```

---

## 9.4 Keep the MVP Simple

The MVP should validate whether the marketplace itself creates value.

Advanced systems such as automated AI valuation, logistics networks, institutional asset management, and integrated payments should not become prerequisites for launching the first version.

---

# 10. MVP Scope

The first version should focus primarily on small-to-medium electronics.

Recommended categories include:

- Smartphones
- Tablets
- Laptops
- Desktop computers
- Computer components
- Monitors
- Printers
- Routers
- Networking equipment
- UPS units
- Small electronic accessories

Large appliances may eventually be supported but are not required for the first MVP.

---

# 11. Core MVP Features

## 11.1 User Accounts

Users should be able to create accounts.

Possible account types:

### Seller / Owner

Can:

- Create listings
- Manage listings
- Receive offers
- Accept or reject offers
- Communicate with potential buyers
- Mark transactions completed

### Buyer / Business

Can:

- Browse listings
- Search listings
- Filter equipment
- Submit offers
- Manage submitted offers
- Communicate with sellers

A user may eventually be allowed to act as both buyer and seller.

---

# 12. Item Listing System

Owners should be able to create listings for unwanted electronics.

Required information should include:

- Item category
- Item name
- Brand
- Model
- Approximate age
- Condition
- Known problems
- Functional status
- Missing components
- Included accessories
- Location
- Photos
- Description

Example:

```text
Item:
Dell Inspiron 15

Condition:
Damaged / Not Working

Details:
- Approximately 6 years old
- Does not boot
- Screen appears intact
- 8 GB RAM
- 500 GB HDD
- Charger included
- Battery condition unknown

Location:
Cagayan de Oro City
```

---

# 13. Item Condition Classification

Listings should use understandable condition categories.

Example:

### Fully Functional

Works normally and can potentially be reused or resold immediately.

### Partially Functional

Works but has defects or missing functionality.

### Repair Needed

Currently unusable but may be repairable.

### For Parts

Device may no longer be practical to repair but contains useful components.

### End of Life

Little practical reuse potential remains and recycling may be appropriate.

Users should not need technical expertise to choose a category.

---

# 14. Marketplace

Buyers should be able to browse available electronics.

Possible marketplace information:

- Product image
- Product name
- Category
- Condition
- Location
- Listing date
- Current offer count

Potential filters:

- Category
- Brand
- Condition
- Location
- Distance
- Listing date

Future filtering may include:

- Specific components
- Device generation
- Estimated repairability
- Pickup availability
- Quantity

---

# 15. Offer System

Businesses and buyers should be able to submit offers for listed items.

An offer may include:

- Offered price
- Message
- Pickup availability
- Preferred meetup method
- Offer expiration

Example:

```text
Offer

Buyer:
CDO Tech Repair

Amount:
₱1,500

Message:
Interested primarily in the motherboard and display.

Pickup:
Available within Cagayan de Oro.
```

---

# 16. Offer Comparison

Sellers should be able to compare offers easily.

Example:

| Buyer           | Buyer Type  |  Offer | Pickup |
| --------------- | ----------- | -----: | ------ |
| CDO Tech Repair | Repair Shop | ₱1,500 | Yes    |
| RePC Solutions  | Refurbisher | ₱1,800 | Yes    |
| PartsHub        | Parts Buyer | ₱1,250 | No     |
| Local Junk Shop | Junk Shop   |   ₱500 | Yes    |

The seller chooses which offer provides the most appropriate value.

The highest monetary offer does not necessarily need to be selected.

---

# 17. Transaction Flow

The MVP transaction flow can remain relatively simple.

```text
Create Listing
      |
      v
Listing Published
      |
      v
Buyers Discover Listing
      |
      v
Offers Submitted
      |
      v
Seller Compares Offers
      |
      v
Seller Accepts Offer
      |
      v
Pickup / Meetup Arranged
      |
      v
Item Transferred
      |
      v
Transaction Completed
```

Initially, payments may happen outside the platform during pickup or meetup.

Integrated payments can be considered later.

---

# 18. Communication

After an offer is submitted or accepted, sellers and buyers should have a way to communicate.

Possible MVP implementation:

- In-app messaging

Possible simpler alternative:

- Exchange contact information after an offer is accepted

The platform should avoid exposing unnecessary personal information publicly.

---

# 19. Location

Location is particularly important because many electronics are inconvenient or expensive to transport.

Listings should display at least:

- City
- Municipality
- General area

Exact home addresses should not be publicly visible.

Future functionality may include:

- Distance-based listings
- Map search
- Service radius
- Pickup zones

---

# 20. Business Profiles

Buyer organizations should have profiles.

Possible information:

- Business name
- Business type
- Location
- Description
- Electronics categories accepted
- Pickup availability
- Contact information
- Ratings
- Completed transactions

Business types may include:

- Repair shop
- Refurbisher
- Reseller
- Recycler
- Junk shop
- Technician

---

# 21. Trust and Reputation

Because transactions involve used and damaged equipment, trust will be important.

Future or early-stage trust features may include:

- Verified accounts
- Business verification
- Seller ratings
- Buyer ratings
- Completed transaction count
- User reporting
- Listing moderation

The MVP may begin with basic ratings and reporting.

---

# 22. Suggested Item Routing

The system may help sellers understand possible destinations for their device.

Example:

```text
Possible Routes

✓ Refurbishment Potential
✓ Parts / Salvage Potential
✓ Recycling Potential
△ Direct Resale Potential
```

This should initially be treated as guidance rather than an authoritative valuation.

Routing can be based on:

- Device condition
- Category
- Known problems
- Buyer demand

---

# 23. Automated Valuation

Automated price estimation is NOT required for the MVP.

Determining electronic-device value accurately is complex because it depends on:

- Device model
- Device age
- Current condition
- Component condition
- Repair costs
- Availability of parts
- Buyer demand
- Local market prices
- Scrap prices

The initial marketplace should use real offers to produce price discovery.

---

# 24. Future Valuation System

Once sufficient marketplace data exists, the platform could generate estimated ranges based on historical transactions.

Example:

```text
Estimated Offer Range

₱1,200 – ₱1,700

Based on:
18 similar completed listings
```

Eventually the platform may use machine learning or AI to analyze:

- Item photos
- Brand
- Model
- Condition
- Historical transactions
- Typical repair value
- Buyer demand

AI should improve the marketplace rather than become a dependency for the initial product.

---

# 25. Expansion Into Appliances

The long-term platform may support larger electronic and electrical equipment.

Possible future categories include:

- Televisions
- Refrigerators
- Washing machines
- Air conditioners
- Microwaves
- Electric fans
- Water dispensers
- Photocopiers
- Large printers
- Commercial electronics
- Office equipment

The same core principle applies:

> Determine whether the item can be reused, repaired, refurbished, salvaged, or recycled before treating it as waste.

---

# 26. Large Appliance Considerations

Large appliances introduce additional product requirements.

These may include:

### Pickup Logistics

Businesses may need to specify:

- Pickup availability
- Vehicle capability
- Maximum item size
- Service radius

### Transportation Cost

An offer may include:

```text
Offer: ₱3,500
Pickup fee: Free
```

or:

```text
Offer: ₱4,000
Transportation: Seller arranged
```

### Accessibility

Listings may eventually include:

- Building floor
- Elevator availability
- Door/access information
- Approximate dimensions
- Approximate weight

### Specialized Handling

Certain equipment may require proper handling because of:

- Refrigerants
- Batteries
- Large capacitors
- Heavy metals
- Other hazardous materials

These requirements should be introduced carefully as the platform expands.

---

# 27. Suggested Expansion Strategy

## Phase 1 — Small Electronics

Focus on:

- Phones
- Laptops
- Computers
- Components
- Monitors
- Networking equipment

Goal:

Validate whether sellers list devices and buyers make offers.

---

## Phase 2 — Medium Electronics

Introduce:

- Printers
- TVs
- UPS units
- Small appliances
- Office electronics

Goal:

Validate broader marketplace categories and local pickup behavior.

---

## Phase 3 — Large Appliances

Introduce:

- Refrigerators
- Washing machines
- Air conditioners
- Large televisions
- Commercial equipment

Goal:

Build logistics and specialized buyer capabilities.

---

## Phase 4 — Institutional Marketplace

Introduce functionality for:

- Universities
- Corporations
- Government institutions
- Large organizations

Possible features:

- Batch listings
- Equipment inventory
- Approval workflows
- Internal transfer
- Disposal documentation
- Audit trails
- Bulk bidding

This phase should only be developed after understanding institutional requirements thoroughly.

---

# 28. Non-Goals for the MVP

The first version should NOT attempt to become:

- A complete waste-management system
- An automated recycling facility
- A logistics company
- A government asset-management system
- A universal electronics pricing engine
- A full repair-management system
- A payment-processing marketplace
- An AI-only valuation product

These may become future opportunities, but they should not distract from marketplace validation.

---

# 29. Marketplace Success Loop

A healthy marketplace should create the following loop:

```text
More Sellers
    |
    v
More Electronics Listings
    |
    v
More Opportunities for Buyers
    |
    v
More Buyers Join
    |
    v
More Offers Per Listing
    |
    v
Better Value Discovery
    |
    v
Better Seller Experience
    |
    v
More Sellers
```

The marketplace becomes more useful as supply and demand grow together.

---

# 30. Primary User Journey

Example household seller:

```text
User finds unused laptop
        |
        v
Visits platform
        |
        v
Creates listing
        |
        v
Uploads photos and condition
        |
        v
Receives multiple offers
        |
        v
Compares:
repair shop / refurbisher / junk shop
        |
        v
Accepts preferred offer
        |
        v
Arranges pickup
        |
        v
Completes transaction
```

---

# 31. Buyer Journey

Example refurbisher:

```text
Refurbisher logs in
        |
        v
Views nearby listings
        |
        v
Filters for laptops
        |
        v
Finds damaged Dell laptop
        |
        v
Evaluates photos / description
        |
        v
Submits ₱1,800 offer
        |
        v
Seller accepts
        |
        v
Pickup arranged
        |
        v
Laptop refurbished / salvaged
```

---

# 32. Marketplace Categories

Suggested initial category hierarchy:

## Computers

- Laptop
- Desktop
- Mini PC
- Server

## Computer Components

- CPU
- GPU
- RAM
- Motherboard
- Storage
- Power supply

## Mobile Devices

- Smartphone
- Tablet
- Smartwatch

## Displays

- Monitor
- Television

## Office Electronics

- Printer
- Scanner
- Projector

## Networking

- Router
- Switch
- Access point
- Modem

## Power Equipment

- UPS
- Power supply
- Battery backup

Future:

## Appliances

- Refrigerator
- Air conditioner
- Washing machine
- Microwave
- Electric fan
- Other appliances

---

# 33. Possible Revenue Models

Revenue should not be the primary concern before product-market validation.

Potential future revenue models include:

### Transaction Fee

The platform receives a small percentage of completed transactions.

### Business Subscription

Businesses pay for:

- Advanced filtering
- Priority notifications
- Larger service areas
- Unlimited offers
- Analytics

### Featured Listings

Sellers pay to increase listing visibility.

### Verified Business Accounts

Businesses pay for enhanced verification or professional marketplace features.

### Logistics Commission

The platform earns from integrated delivery or pickup partners.

These models should only be explored once marketplace behavior is validated.

---

# 34. Key Marketplace Metrics

The MVP should measure whether the platform actually solves the identified problem.

Important metrics include:

## Supply Metrics

- Number of listings
- Number of active sellers
- Listings created per week

## Demand Metrics

- Number of active buyers
- Offers submitted
- Offers per listing

## Marketplace Metrics

- Percentage of listings receiving an offer
- Time until first offer
- Average number of offers per listing
- Offer acceptance rate
- Transaction completion rate

## User Value Metrics

- Difference between highest and lowest offer
- Percentage of items routed toward reuse or repair
- Percentage routed directly toward recycling
- Number of electronics prevented from premature disposal

---

# 35. MVP Success Criteria

The MVP should be considered promising if:

- Sellers are willing to list unwanted electronics.
- Businesses regularly browse available listings.
- Listings receive multiple legitimate offers.
- Sellers find those offers useful for making disposal decisions.
- Buyers successfully acquire electronics through the platform.
- Users return to the marketplace after their first transaction.

The strongest signal will not simply be user registrations.

The strongest signal will be:

> **Completed exchanges between electronics owners and buyers.**

---

# 36. Research Questions Still To Validate

The following questions should be answered through further interviews and MVP testing.

## Seller Side

- How frequently do households accumulate unused electronics?
- How long do they normally keep these items?
- Would they take photos and create a listing?
- How much additional value would make listing worthwhile?
- Would they prefer pickup or meetup?
- Would they trust offers from unknown businesses?
- What information would make them comfortable accepting an offer?

## Buyer Side

- Where do repair shops currently source electronics?
- Do refurbishers struggle to find inventory?
- Which categories are most valuable to them?
- How far are they willing to travel?
- Can they estimate value from photos and descriptions?
- Would they actively monitor marketplace listings?
- Would they pay for access to high-quality listings?
- What would make them return weekly?

---

# 37. Competitive Advantage

The product should not compete solely on being another second-hand marketplace.

General marketplaces mainly answer:

> **Who wants to buy this item?**

This platform should answer:

> **What useful life still remains in this item, and who is best positioned to extract that value?**

The marketplace includes buyers that traditional consumer marketplaces may not emphasize:

- Repair technicians
- Refurbishers
- Parts buyers
- Recyclers
- Junk shops

This allows even damaged or non-functional equipment to potentially find a buyer.

---

# 38. Product Positioning

The platform should avoid positioning every listed item immediately as "e-waste."

An old or broken electronic device may still be an asset.

Useful terminology includes:

- Used electronics
- Unwanted electronics
- Pre-owned electronics
- Repairable electronics
- Salvage electronics
- End-of-life electronics

"E-waste" should mainly represent equipment that has reached the final recycling or disposal stage.

---

# 39. Core Product Message

### Seller Message

> **Don't junk it before you know what it's worth.**

### Buyer Message

> **Find electronics worth repairing, refurbishing, salvaging, or recycling.**

### Sustainability Message

> **Give electronics their highest-value next use before disposal.**

---

# 40. Product Design Philosophy

The product interface should feel:

- Simple
- Trustworthy
- Local
- Accessible
- Practical
- Marketplace-oriented

Users should not need technical knowledge about electronics.

Listing an item should be as easy as:

```text
Take Photos
     ↓
Identify Device
     ↓
Describe Condition
     ↓
Publish Listing
     ↓
Receive Offers
```

Technical complexity should primarily be handled by the businesses evaluating listings rather than by ordinary sellers.

---

# 41. Long-Term Vision

The platform could eventually become infrastructure for a local circular economy around electronics and appliances.

Instead of the traditional lifecycle:

```text
Buy
 ↓
Use
 ↓
Store
 ↓
Throw Away
```

the platform encourages:

```text
Buy
 ↓
Use
 ↓
Resell
 ↓
Repair
 ↓
Refurbish
 ↓
Reuse Parts
 ↓
Recycle Materials
```

The goal is to keep products and their components economically useful for as long as reasonably possible.

---

# 42. Product Summary

The product is not primarily an e-waste collection platform.

It is a **value discovery and routing marketplace for unwanted electronics**.

It connects:

```text
People who have electronics
            +
People who can extract value from electronics
```

The platform enables users to discover whether an item should be:

- Resold
- Reused
- Repaired
- Refurbished
- Salvaged
- Recycled

The MVP should focus on proving one fundamental behavior:

> **When electronics owners can expose their unused devices to multiple types of interested buyers, can the marketplace discover better outcomes than simply defaulting to junk-shop disposal?**

Everything else should evolve from the answer to that question.
