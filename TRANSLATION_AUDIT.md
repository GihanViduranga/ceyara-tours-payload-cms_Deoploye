# Translation Audit Report
## Missing Translations in Locale Files

This document identifies hardcoded user-facing text that needs to be added to locale files for translation.

## Summary
- **Total Pages Checked**: 38
- **Pages with Missing Translations**: Multiple
- **Priority**: HIGH - User-facing text should be translatable

---

## 1. Plan Your Trip Page (`src/app/(frontend)/plan-your-trip/page.tsx`)

### Missing Translations:

1. **Location & Map Related:**
   - `"Getting Location..."` (line 1397)
   - `"📍 Use My Current Location"` (line 1397)
   - `"Loading map..."` (line 1312)
   - `"Your Location"` (multiple occurrences)
   - `"Map is not loaded yet. Please wait."` (line 486)
   - `"Geolocation is not supported by your browser."` (line 366)
   - `"Your location is outside Sri Lanka. Please select a location within Sri Lanka."` (line 391)
   - `"Location access denied. Please allow location access or enter your location manually."` (line 494)
   - `"Location information unavailable. Please enter your location manually."` (line 499)
   - `"Location request timed out. Please try again or enter your location manually."` (line 504)
   - `"An error occurred while getting your location. Please enter your location manually."` (line 509)
   - `"Please select a location within Sri Lanka only."` (lines 251, 273)
   - `"Please type a valid location first."` (line 1225)

2. **Point Labels:**
   - `"Start"` (line 1287)
   - `"End"` (line 1288)
   - `"Point ${index}"` (line 1289)

3. **Duration & Cost Formatting:**
   - `"min"` / `"mins"` (line 1293)
   - `"hour"` / `"hours"` (lines 1296-1297)
   - `"LKR"` currency prefix (line 1301)

4. **Vehicle Selection:**
   - `"Select Vehicle"` (line 1327)

5. **Loading Messages:**
   - `"Loading system suggesting places..."` (line 1935)
   - `"Loading nearby places..."` (line 1965)

6. **Plan Your Trip Specific:**
   - `"Trip Planned!"` (line 1755)
   - `"Your route has been planned. You can continue adding more waypoints or submit your trip."` (line 1900)

---

## 2. Our Team Page (`src/app/(frontend)/our-story/our-team/page.tsx`)

### Missing Translations:

1. **Team Member Roles (hardcoded):**
   - `"Founder / Managing Director"` (line 17)
   - `"Sales Manager"` (lines 22, 27)
   - `"Accountant"` (line 32)
   - `"Senior Executive Operations and Marketing"` (line 37)
   - `"Accounts Executive"` (line 42)

**Note:** Team member names (Dinesh, Nimesha, etc.) should remain as-is (proper nouns).

---

## 3. Navigation API Route (`src/app/(frontend)/api/navigation/route.ts`)

### Missing Translations:

1. **Itinerary Categories (all hardcoded):**
   - `"Adventure & Nature based Tours"`
   - `"Culture & Heritage Tours"`
   - `"Family Tours"`
   - `"Luxury Bespoke Tours"`
   - `"North & East Coast Tours"`
   - `"Popular Tours"`
   - `"Purpose Built Tours"`
   - `"Romantic Tours"`
   - `"Special Transit Tours"`
   - `"Sports Based Tours"`
   - `"Sustainable Tours"`
   - `"Wellness Tours"`
   - `"Wildlife Tours"`

2. **Day Tour Names (all hardcoded):**
   - `"Anuradhapura Day Tour"`
   - `"Belihuloya Day Tour"`
   - `"Day Tour of Colombo"`
   - `"Galle Day Tour"`
   - `"Geoffrey Bawa Works in Sri Lanka"`
   - `"Hot Air Ballooning Day Tour"`
   - `"Kandy Day Tour"`
   - `"Kithulgala White Water Rafting"`
   - `"Little England Day Tour"`
   - `"Negombo Lagoon Fishing Day Tour"`
   - `"Polonnaruwa Day Tour"`
   - `"Sigiriya & Dambulla Day Tour"`
   - `"Sinharaja Day Tour"`
   - `"Udawalawe National Park Day Tour"`
   - `"Whale Watching Day Tour"`
   - `"Wilpattu National Park Day Tour"`
   - `"Yala National Park Day Tour"`

3. **Discover Sri Lanka:**
   - `"Destinations"`
   - `"Experiences"`

4. **Our Story:**
   - `"About"`
   - `"Our Team"`

**Note:** These should use translation keys from locale files instead of hardcoded strings.

---

## 4. Loading & Error Messages (Multiple Pages)

### Missing Translations:

1. **Generic Loading Messages:**
   - `"Loading tours..."` (itineraries page, homepage)
   - `"Loading map..."` (plan your trip)
   - `"Loading system suggesting places..."` (plan your trip)
   - `"Loading nearby places..."` (plan your trip)

2. **Generic Error Messages:**
   - `"Error loading tours: {error}"` (itineraries page)
   - `"Post not found"` (blog detail)
   - `"Failed to load post"` (blog detail)
   - `"Package not found"` (Maldives detail)
   - `"Experience not found"` (experiences detail)
   - `"Destination not found"` (destinations detail)
   - `"Tour not found"` (itinerary detail)
   - `"Failed to fetch navigation"` (navigation API)

---

## 5. Homepage (`src/app/(frontend)/page.tsx`)

### Missing Translations:

1. **Image Alt Text:**
   - `"Sri Lanka Tourism"` (line 227)
   - `"Sigiriya Rock Formation"` (line 270)

2. **Loading:**
   - `"Loading tours..."` (line 322)

---

## 6. Blog Pages

### Already Using Translations:
- Most text appears to use translation keys from `blog.*` namespace

### Missing Translations:
- Error messages (see Loading & Error Messages section)

---

## 7. Enquiry Page (`src/app/(frontend)/enquiry/page.tsx`)

### Missing Translations:

1. **WhatsApp/Messenger Message Template:**
   All hardcoded strings in message generation (lines 35-83):
   - `"🌴 *Ceyara Tours - Travel Enquiry* 🌴"`
   - `"*Personal Information:*"`
   - `"👤 Name:"`
   - `"📧 Email:"`
   - `"📱 Phone:"`
   - `"🌍 Country:"`
   - `"*Travel Details:*"`
   - `"📅 Travel Dates:"`
   - `"⏰ Duration:"`
   - `"👥 Number of Travelers:"`
   - `"💰 Budget Range:"`
   - `"*Interests:*"`
   - `"*Additional Message:*"`
   - `"---"`
   - `"*Sent from Ceyara Tours Website*"`

**Note:** The enquiry page form fields already use translations, but the generated messages are hardcoded.

---

## 8. Itineraries Page (`src/app/(frontend)/itineraries/page.tsx`)

### Missing Translations:

1. **Loading & Error:**
   - `"Loading tours..."` (line 143)
   - `"Error loading tours: {error}"` (line 153)

---

## 9. Day Tours Pages

### Status:
- Most day tour pages use translation keys from `dayTours.*` namespace
- Individual tour pages should use translations from locale files

---

## 10. Accommodation, Maldives, Discover Sri Lanka Pages

### Status:
- Most pages appear to use CMS data with translations
- Check individual pages for any hardcoded fallback text

---

## Recommendations

### Priority 1 (User-Facing UI):
1. Plan Your Trip page - All location/error messages
2. Navigation API - All menu items should use translation keys
3. Loading/Error messages - Standardize across all pages
4. Our Team page - Role translations

### Priority 2 (User-Generated Content):
1. Enquiry page - WhatsApp/Messenger message templates
2. Form placeholders and labels (most already translated)

### Priority 3 (Meta/Alt Text):
1. Image alt text
2. Console messages (can remain in English)

---

## Next Steps

1. Add all missing translations to `src/locales/en.json`
2. Translate to other languages (DE, FR, NL, IT, ES, RU)
3. Update code to use translation keys instead of hardcoded strings
4. Test all pages with different languages

---

## Files That Need Updates

1. `src/app/(frontend)/plan-your-trip/page.tsx` - Many hardcoded strings
2. `src/app/(frontend)/api/navigation/route.ts` - All menu items hardcoded
3. `src/app/(frontend)/our-story/our-team/page.tsx` - Role names hardcoded
4. `src/app/(frontend)/enquiry/page.tsx` - Message templates hardcoded
5. Multiple pages - Loading/Error messages need standardization

---

**Last Updated**: $(date)
**Audited By**: AI Assistant
