# Item Form (ItemFormPage.tsx) — Complete Test Plan

> **Total test cases: 95**
> Covers all 30 remaining VB.NET features implemented + previously built features.
> Each test case includes: Steps, Expected Result, and which VB.NET feature # it validates.

---

## PREREQUISITES

Before testing, ensure:
1. Backend API is running (`BackOffice.Api`)
2. Frontend dev server is running (`npm run dev`)
3. You have a user account with **Admin** or **SuperAdmin** role (for full permission testing)
4. At least **2 stores** exist in the system
5. At least **1 department** exists with `DefaultMarkup > 0`, `RoundUp > 0`, `IsDefaultTaxInclude = true`
6. At least **1 item** already exists (for edit mode testing)
7. Have a second user account with **limited permissions** (no BO_ItemChangePrice, etc.)

---

## SECTION A: INLINE VALIDATIONS

### TC-A01: Item Name Duplicate Warning (#67)
**Steps:**
1. Open New Item form
2. Type an **existing** item name in the Name field (copy from an existing item)
3. Click/tab out of the Name field (trigger blur)

**Expected:** Amber "Duplicate name" warning appears next to the Name field. "Checking..." spinner shows briefly during API call. Warning is non-blocking (you can still save).

### TC-A02: Item Name — No Warning for Unique Name (#67)
**Steps:**
1. Open New Item form
2. Type a completely new unique name (e.g., "XYZTEST_UNIQUE_12345")
3. Tab out of the Name field

**Expected:** No warning appears. No spinner after check completes.

### TC-A03: Item Name — Short Name Skips Check (#67)
**Steps:**
1. Type only 1 or 2 characters in the Name field
2. Tab out

**Expected:** No API call made, no warning shown (minimum 3 chars required).

### TC-A04: Model Number (Alt Code) Duplicate Error (#66)
**Steps:**
1. Open New Item form
2. Find an existing item's alternate code (modal number)
3. Type that same code in the "Alt" field
4. Tab out of the field

**Expected:** Red "X" error indicator appears. "..." spinner shows briefly during check.

### TC-A05: Model Number — Blocks Save (#66)
**Steps:**
1. Complete TC-A04 so the Alt code shows an error
2. Fill in all other required fields (Name, UPC, Department)
3. Click "Save & Close"

**Expected:** Toast error appears: "Model number 'XXX' already exists." Save is blocked.

### TC-A06: Model Number — No Error in Edit Mode for Own Code (#66)
**Steps:**
1. Open an existing item in Edit mode
2. The Alt code field shows the item's own model number
3. Tab out of the Alt code field WITHOUT changing it

**Expected:** No error shown (the check excludes the current item's ID).

### TC-A07: Model Number — Clear Error on Typing (#66)
**Steps:**
1. Trigger a model number error (TC-A04)
2. Start typing in the Alt field to change the value

**Expected:** The red error indicator disappears immediately while typing.

### TC-A08: Alias Barcode Duplicate Error (#68)
**Steps:**
1. Go to Extra tab → UPC Codes section
2. Click "+ Add" to add a new UPC code row
3. Type an existing item's barcode (from any item in the system)
4. Tab out of the input

**Expected:** Red border on the input + red error message below: "Barcode 'XXX' already exists."

### TC-A09: Alias Barcode — Multiple Rows Independent (#68)
**Steps:**
1. Add 3 UPC code rows
2. Enter a duplicate barcode in row 1
3. Enter a unique barcode in row 2
4. Enter another duplicate in row 3
5. Tab out of each

**Expected:** Rows 1 and 3 show errors. Row 2 is clean. Each row validates independently.

### TC-A10: Alias Barcode — Blocks Save (#68)
**Steps:**
1. Have at least one alias barcode error showing
2. Try to save

**Expected:** Toast error: "One or more alias barcodes already exist. Please fix before saving."

### TC-A11: Alias Barcode — Error Clears on Typing (#68)
**Steps:**
1. Trigger an alias error (TC-A08)
2. Start modifying the barcode text

**Expected:** Error clears immediately while typing.

---

## SECTION B: SAVE VALIDATIONS

### TC-B01: Department Required (#4)
**Steps:**
1. Open New Item form
2. Fill in Name and UPC
3. Leave Department empty
4. Click "Save & Close"

**Expected:** Toast error: "Department is required"

### TC-B02: Restock Level < Reorder Point (#10)
**Steps:**
1. Open New Item form
2. Go to Sales tab → Inventory section
3. Set Reorder Point = 10
4. Set Restock Level = 5 (less than Reorder Point)
5. Fill other required fields and try to save

**Expected:** Toast error: "Restock Level cannot be less than Reorder Point"

### TC-B03: Restock Level = Reorder Point — OK (#10)
**Steps:**
1. Set Reorder Point = 10, Restock Level = 10
2. Save

**Expected:** No error for this check (equal values are allowed).

### TC-B04: Case Qty = 0 with Case Cost Set (#6)
**Steps:**
1. Check "Cost By Case" checkbox
2. Set Case Cost = $10.00
3. Leave Case Qty = 0
4. Try to save

**Expected:** Toast error: "Case Qty can't be zero when Case Cost is set"

### TC-B05: PriceByCase ON but CaseQty = 0 (#7)
**Steps:**
1. Check "Set prices for case" checkbox
2. Leave Case Qty = 0
3. Try to save

**Expected:** Toast error: "Case Qty must be set when 'Set Prices for Case' is enabled"

### TC-B06: Cost > Price Warning (#8/#18)
**Steps:**
1. Set Cost = $10.00
2. Set Price = $5.00 (cost > price)
3. Fill all required fields
4. Click Save

**Expected:** Confirmation dialog appears: "The cost ($10.00) is greater than the price ($5.00). This item will sell at a loss. Do you want to continue?" with Yes/No buttons.

### TC-B07: Cost > Price — Click No (#8)
**Steps:**
1. Trigger TC-B06
2. Click "No"

**Expected:** Save is cancelled. Form stays open.

### TC-B08: Cost > Price — Click Yes (#8)
**Steps:**
1. Trigger TC-B06
2. Click "Yes"

**Expected:** Save proceeds (or next validation runs).

### TC-B09: Price = $0.00 Warning (#9/#19)
**Steps:**
1. Leave Price = $0.00 (default)
2. Fill all required fields
3. Click Save

**Expected:** Confirmation dialog: "The price is $0.00. Are you sure you want to save this item with a zero price?"

### TC-B10: Barcode Uniqueness Blocks Save (#3)
**Steps:**
1. In the UPC field, enter a barcode that already exists
2. Tab out (triggers barcode check)
3. Wait for error to appear
4. Try to save

**Expected:** Save is blocked with the barcode error message.

### TC-B11: Item Name Required (#1)
**Steps:**
1. Leave Name empty
2. Try to save

**Expected:** Toast error: "Item name is required"

### TC-B12: UPC Required (#2)
**Steps:**
1. Fill Name but leave UPC empty
2. Try to save

**Expected:** Toast error: "Barcode/UPC is required"

---

## SECTION C: SALE TYPE VALIDATIONS

### TC-C01: Standard Sale — Special Price Must Be > 0 (#13)
**Steps:**
1. Go to Specials tab
2. Select "Standard" sale type
3. Leave Special Price = 0
4. Try to save

**Expected:** Toast error: "Special Price must be greater than zero for Standard sale type". Tab switches to Specials.

### TC-C02: Break Down — Item Count Must Be > 0 (#14)
**Steps:**
1. Select "Break Down" sale type
2. Leave Item Count = 0
3. Try to save

**Expected:** Toast error: "Item Count must be greater than zero for Break Down sale type"

### TC-C03: Combined — Sale Price Must Be > 0 (#15)
**Steps:**
1. Select "Combined" sale type
2. Leave Sale Price = 0
3. Try to save

**Expected:** Toast error: "Sale Price must be greater than zero for Combined sale type"

### TC-C04: Mix & Match — Selection Required (#16)
**Steps:**
1. Select "Mix & Match" sale type
2. Don't select any Mix & Match group
3. Try to save

**Expected:** Toast error: "Please select a Mix & Match group"

### TC-C05: Assign Date — Date Range Validation (#17)
**Steps:**
1. Select any sale type (e.g., Standard)
2. Check "Assign Date"
3. Set From date to 2026-03-15
4. Set To date to 2026-03-10 (before From)
5. Try to save

**Expected:** Toast error: "Start date cannot be after end date"

### TC-C06: Future Pricing — Must Be Future Date (#69)
**Steps:**
1. Go to Specials tab → Future Pricing section
2. Set New Price = $5.00
3. Set Date Effective to today's date or a past date

**Expected:** Inline red text "Must be a future date" appears. Save shows error: "Date Effective must be a future date".

### TC-C07: Future Pricing — New Price Without Date (#69)
**Steps:**
1. Set New Price = $5.00
2. Leave Date Effective empty
3. Try to save

**Expected:** Toast error: "Date Effective is required when New Price is set"

---

## SECTION D: SALE TYPE TOGGLE BEHAVIORS (#51-54)

### TC-D01: Switch from Standard to No Sale (#53)
**Steps:**
1. Select "Standard" sale type
2. Set Special Price = $5.00, Min Qty = 2, Max Qty = 10
3. Switch to "No Sale"

**Expected:** All special fields are cleared: Special Price = 0, Min Qty = 0, Max Qty = 0, Minimum Total Sale = 0, Assign Date unchecked, dates cleared.

### TC-D02: Switch from Mix & Match to Standard (#51)
**Steps:**
1. Select "Mix & Match" sale type
2. Set Qty = 5, Amount = $10.00
3. Switch to "Standard"

**Expected:** Mix & Match fields (Selection, Qty, Amount) are cleared. Standard form shows with empty fields.

### TC-D03: Switch from Break Down to Combined (#52)
**Steps:**
1. Select "Break Down"
2. Set Item Count = 6
3. Switch to "Combined"

**Expected:** Item Count is cleared (reset to 0). Combined form shows.

### TC-D04: Switch from Combined to No Sale (#54)
**Steps:**
1. Select "Combined"
2. Set Sale Price = $3.00, Pkg Price = $10.00, Pkg For = 4
3. Switch to "No Sale"

**Expected:** All combined fields cleared (Sale Price, Pkg Price, Pkg For, margins).

### TC-D05: Switch from No Sale to Standard — Default Dates Set
**Steps:**
1. Start with "No Sale" selected
2. Switch to "Standard"

**Expected:** Assign Date is automatically checked. From date = today, To date = today + 7 days.

### TC-D06: Switch between Standard and Break Down — Separate Fields
**Steps:**
1. Select "Standard", set Special Price = $5.00
2. Switch to "Break Down"

**Expected:** Standard's Special Price is cleared. Break Down form shows with empty fields.

---

## SECTION E: DEPARTMENT CHANGE BEHAVIOR (#21/#22/#43/#55)

### TC-E01: New Item — Department Auto-Sets Checkboxes (#55)
**Steps:**
1. Open New Item form
2. Make sure Taxable, FoodStamp, Discountable are all unchecked
3. Select a department that has `IsDefaultTaxInclude = true`, `IsDefaultFoodStampable = true`, `IsDefaultDiscountable = true`

**Expected:** Taxable, Food Stamp, and Discountable checkboxes are automatically checked. Tax dropdown is set to the department's default tax.

### TC-E02: Edit Mode — Department Does NOT Auto-Set Checkboxes (#55)
**Steps:**
1. Open an existing item in Edit mode
2. Change the department to one with different defaults

**Expected:** Taxable, Food Stamp, Discountable checkboxes are NOT changed (auto-set only applies to new items).

### TC-E03: Department Markup Confirmation (#21)
**Steps:**
1. Open New Item form
2. Set Cost = $10.00
3. Select a department with DefaultMarkup = 50%

**Expected:** Confirmation dialog: "Department 'XXX' has a default markup of 50%. Apply this markup to calculate the price?" with Yes/No.

### TC-E04: Department Markup — Click Yes (#21)
**Steps:**
1. Trigger TC-E03
2. Click "Yes"

**Expected:** Price is calculated: $10.00 + 50% = $15.00. Markup field = 50%. Profit Margin is calculated. If department has RoundUp, price is rounded (see TC-E05).

### TC-E05: Department Roundup Applied (#22/#43)
**Steps:**
1. Set Cost = $10.00
2. Select a department with DefaultMarkup = 33% and RoundUp = 1 (round to .X9)
3. Click "Yes" on the markup confirmation

**Expected:** Raw price = $13.30. After roundup to .X9 → $13.39. Toast: "Price rounded to $13.39 using department roundup rules".

### TC-E06: Department Markup — Click No
**Steps:**
1. Trigger TC-E03
2. Click "No"

**Expected:** Price is NOT changed. Department is still set (checkboxes may have changed for new items).

### TC-E07: Department With No Markup
**Steps:**
1. Select a department with DefaultMarkup = 0 or null

**Expected:** No markup confirmation dialog appears. Department is set normally.

---

## SECTION F: MULTI-STORE FEATURES (#23/#72/#73)

### TC-F01: Save to All Stores Confirmation (#23)
**Steps:**
1. Ensure at least 2 stores exist
2. Check "Save To All Stores" checkbox
3. Fill all required fields
4. Click "Save & Close"

**Expected:** Confirmation dialog: "This will save the item to all X stores. Are you sure?" with 3 buttons: "Save to All" / "Current Store Only" / "Cancel".

### TC-F02: Save to All — Click "Save to All" (#23)
**Steps:**
1. Trigger TC-F01
2. Click "Save to All"

**Expected:** Item is saved to all stores.

### TC-F03: Save to All — Click "Current Store Only" (#23)
**Steps:**
1. Trigger TC-F01
2. Click "Current Store Only"

**Expected:** Item is saved only to the selected store. saveToAllStores is unchecked.

### TC-F04: Save to All — Click "Cancel" (#23)
**Steps:**
1. Trigger TC-F01
2. Click "Cancel"

**Expected:** Save is cancelled. Form stays open.

### TC-F05: Store Switch with Unsaved Changes (#72)
**Steps:**
1. Open an existing item in Edit mode
2. Change the Price (to make the form dirty)
3. Observe "Unsaved changes" amber badge appears
4. Change the Store dropdown to a different store

**Expected:** Confirmation dialog: "You have unsaved changes. Switching stores will discard these changes." with 3 buttons: "Save First" / "Discard & Switch" / "Cancel".

### TC-F06: Store Switch — Save First (#72)
**Steps:**
1. Trigger TC-F05
2. Click "Save First"

**Expected:** Item is saved first. If save succeeds, store switches and data reloads.

### TC-F07: Store Switch — Discard & Switch (#72)
**Steps:**
1. Trigger TC-F05
2. Click "Discard & Switch"

**Expected:** Changes are discarded. Store switches. Item data reloads for the new store.

### TC-F08: Store Switch — Cancel (#72)
**Steps:**
1. Trigger TC-F05
2. Click "Cancel"

**Expected:** Store stays on the current selection. Form data is unchanged.

### TC-F09: Store Switch — No Changes (#73)
**Steps:**
1. Open an existing item (no changes made)
2. Switch to a different store

**Expected:** No confirmation dialog. Store switches immediately. Data reloads.

---

## SECTION G: UNSAVED CHANGES (#20)

### TC-G01: Cancel with Unsaved Changes
**Steps:**
1. Open New Item form
2. Type something in the Name field
3. Click "Cancel"

**Expected:** 3-button dialog: "You have unsaved changes. Do you want to save before leaving?" with "Save & Close" / "Discard" / "Cancel".

### TC-G02: Cancel — Save & Close
**Steps:**
1. Trigger TC-G01
2. Click "Save & Close"

**Expected:** Attempts to save. If validation fails, form stays open. If save succeeds, navigates back to list.

### TC-G03: Cancel — Discard
**Steps:**
1. Trigger TC-G01
2. Click "Discard"

**Expected:** Changes are thrown away. Navigates back to Item List.

### TC-G04: Cancel — Cancel Button
**Steps:**
1. Trigger TC-G01
2. Click "Cancel"

**Expected:** Dialog closes. Form stays open with all changes intact.

### TC-G05: Cancel with No Changes
**Steps:**
1. Open an existing item
2. Don't change anything
3. Click "Cancel"

**Expected:** No dialog. Immediately goes back to Item List.

### TC-G06: Unsaved Changes Badge
**Steps:**
1. Open an existing item
2. Change any field value

**Expected:** Amber badge "● Unsaved changes" appears in the header bar.

### TC-G07: Unsaved Changes Badge Clears After Save
**Steps:**
1. Make a change (badge appears)
2. Save successfully

**Expected:** Badge disappears after save.

---

## SECTION H: SUPPLIER MANAGEMENT (#25/#76)

### TC-H01: Add First Supplier
**Steps:**
1. Go to Vendor tab
2. Click "+ Add Supplier"

**Expected:** New supplier row appears with Main Supplier checked (first vendor is main by default). No confirmation dialog for the first supplier.

### TC-H02: Add Second Supplier — Confirmation (#25)
**Steps:**
1. Already have 1 supplier
2. Click "+ Add Supplier"

**Expected:** Confirmation dialog: "Add another supplier to this item? The first supplier is typically the main supplier." Click Yes to add.

### TC-H03: Edit Supplier Data
**Steps:**
1. Add a supplier
2. Type in Gross Cost = $100.00
3. Type Case Qty = 12

**Expected:** Pc Cost auto-calculates: $100.00 / 12 = $8.33.

### TC-H04: Remove Supplier — Confirmation (#76)
**Steps:**
1. Have at least 1 supplier
2. Click the X (close) button on a supplier row

**Expected:** Confirmation dialog: "Are you sure you want to remove 'Supplier Name' from this item?"

### TC-H05: Remove Main Supplier — Reassignment (#76)
**Steps:**
1. Have 2 suppliers. First is main.
2. Remove the first (main) supplier

**Expected:** After removal, the remaining supplier automatically becomes the main supplier.

### TC-H06: Toggle Main Supplier
**Steps:**
1. Have 2 suppliers
2. Check "Main Supplier" on the second one

**Expected:** Second becomes main. First's main checkbox is automatically unchecked (only one main supplier allowed).

---

## SECTION I: ALIAS / UPC CODE MANAGEMENT (#26)

### TC-I01: Add UPC Code
**Steps:**
1. Go to Extra tab → UPC Codes section
2. Click "+ Add"

**Expected:** New empty row appears in the UPC Codes table.

### TC-I02: Remove UPC Code — Confirmation for Non-Empty (#26)
**Steps:**
1. Add a UPC code and type "1234567890"
2. Click the X button on that row

**Expected:** Confirmation dialog: "Remove UPC code '1234567890' from this item?"

### TC-I03: Remove Empty UPC Code — No Confirmation
**Steps:**
1. Add a UPC code row (leave it empty)
2. Click the X button

**Expected:** Row is removed immediately with no confirmation (empty code).

---

## SECTION J: PERMISSION CONTROLS (#64 + field permissions)

### TC-J01: View Permission Denied (#64)
**Steps:**
1. Log in as a user WITHOUT `ITEMS_LIST.View` and `BO_ItemsShow` permissions
2. Navigate to an Item form

**Expected:** "Access Denied" screen with lock icon and message "You don't have permission to view items." with a "Go Back" button.

### TC-J02: Price Field Disabled Without Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.ChangePrice` / `BO_ItemChangePrice`
2. Open an existing item in Edit mode

**Expected:** Price field is disabled/greyed out. Case Price field is also disabled.

### TC-J03: Cost Field Disabled Without Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.ChangeCost` / `BO_ItemChangeCost`
2. Open an existing item

**Expected:** Case Cost and Piece Cost fields are disabled. Cost shows as "***" if `ShowCost` permission is also missing.

### TC-J04: Department Field Disabled Without Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.ChangeDepartment` / `BO_ItemChangeDep`
2. Open existing item

**Expected:** Department dropdown is disabled in Edit mode.

### TC-J05: Group Field Disabled Without Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.ChangeGroup` / `BO_ItemChangeGroup`
2. Open existing item

**Expected:** Group dropdown is disabled in Edit mode.

### TC-J06: Special Price Disabled Without Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.AssignSpecialPrice` / `BO_ItemAssSpecialPrice`
2. Open existing item → Specials tab

**Expected:** Special Price, Sale Price fields are disabled in Edit mode.

### TC-J07: Save Buttons Disabled Without Edit Permission
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.Edit` / `BO_ItemsEdit`
2. Open existing item

**Expected:** "Save & Close" and "Save & New" buttons are disabled.

### TC-J08: Save Buttons Disabled Without Add Permission (New Item)
**Steps:**
1. Log in as user WITHOUT `ITEMS_LIST.Create` / `BO_ItemsAdd`
2. Open New Item form

**Expected:** "Save & Close" and "Save & New" buttons are disabled.

### TC-J09: Admin/SuperAdmin Bypasses All Permissions
**Steps:**
1. Log in as SuperAdmin or TenantAdmin
2. Open any item in Edit mode

**Expected:** All fields are editable. All buttons are enabled.

---

## SECTION K: PRICING CALCULATIONS

### TC-K01: Price → Margin/Markup Auto-Calculate
**Steps:**
1. Set Cost = $10.00
2. Set Price = $15.00

**Expected:** Profit Margin = 33.33%, Markup = 50.00%.

### TC-K02: Margin → Price/Markup Auto-Calculate
**Steps:**
1. Set Cost = $10.00
2. Type Profit Margin = 40%

**Expected:** Price = $16.67, Markup = 66.67%.

### TC-K03: Markup → Price/Margin Auto-Calculate
**Steps:**
1. Set Cost = $10.00
2. Type Markup = 50%

**Expected:** Price = $15.00, Profit Margin = 33.33%.

### TC-K04: Lock Markup — Cost Change Recalculates Price (#42/#48)
**Steps:**
1. Set Cost = $10.00, Markup = 50% (Price = $15.00)
2. Check "Lock Markup" checkbox
3. Change Cost to $12.00

**Expected:** Price auto-recalculates to $18.00 (maintaining 50% markup). Margin also updates.

### TC-K05: Lock Markup OFF — Cost Change Recalculates Margin
**Steps:**
1. Set Cost = $10.00, Price = $15.00 (Markup = 50%)
2. Ensure "Lock Markup" is unchecked
3. Change Cost to $12.00

**Expected:** Price stays at $15.00. Margin recalculates to 20%. Markup recalculates to 25%.

### TC-K06: Case Cost → Piece Cost Auto-Derive
**Steps:**
1. Check CostByCase checkbox
2. Set Case Cost = $24.00
3. Set Case Qty = 12

**Expected:** Piece Cost = $2.00 (24/12).

### TC-K07: Lock Markup with Case Cost Change (#42)
**Steps:**
1. Check CostByCase, Lock Markup
2. Set Case Cost = $24.00, Case Qty = 12, Markup = 50%
3. Price should be $3.00 (piece cost $2 + 50%)
4. Change Case Cost to $30.00

**Expected:** Piece Cost = $2.50. Price auto-updates to $3.75 (maintaining 50% markup).

### TC-K08: Special Price Margin/Markup (#39)
**Steps:**
1. Set Cost = $10.00
2. Go to Specials → Standard
3. Set Special Price = $12.00

**Expected:** Special Profit Margin and Special Markup auto-calculate.

### TC-K09: Special Margin → Price (#40)
**Steps:**
1. Set Cost = $10.00
2. Type Special Profit Margin = 20%

**Expected:** Special Price = $12.50. Special Markup auto-calculates.

### TC-K10: Combined — Pkg Price/For → Margin (#41)
**Steps:**
1. Set Cost = $10.00
2. Go to Specials → Combined
3. Set Pkg Price = $40.00, For = 5

**Expected:** Price per unit = $8.00. Pkg Margin and Pkg Markup reflect $8.00 vs $10.00 cost.

---

## SECTION L: MATRIX SUPPORT (#75/#24)

### TC-L01: Switch to Matrix Type — Confirmation (#24)
**Steps:**
1. Item Type is "Standard" (0)
2. Change to "Matrix" (2)

**Expected:** Confirmation dialog: "Changing to Matrix type will make this item a parent matrix..."

### TC-L02: Switch to Matrix Child — Confirmation (#24)
**Steps:**
1. Change Item Type to "Matrix Child" (3)

**Expected:** Confirmation dialog with different message about linking to parent.

### TC-L03: Matrix Badge Display (#75)
**Steps:**
1. Confirm the type change to Matrix

**Expected:** Purple badge appears: "Matrix Parent — children inherit from this item"

### TC-L04: Matrix Child Badge (#75)
**Steps:**
1. Confirm change to Matrix Child

**Expected:** Indigo badge: "Matrix Child — linked to a parent matrix"

### TC-L05: Switch FROM Matrix — Confirmation (#24)
**Steps:**
1. Item is Matrix type
2. Change back to "Standard"

**Expected:** Warning dialog: "Changing from a Matrix type may affect linked items. Are you sure?"

---

## SECTION M: PRINT LABEL & BUILD NAME (#78/#79)

### TC-M01: Print Label Button — Edit Mode Only (#78)
**Steps:**
1. Open an existing item in Edit mode

**Expected:** "Print" button with printer icon is visible in the header.

### TC-M02: Print Label Button — Not Shown in New Mode (#78)
**Steps:**
1. Open New Item form

**Expected:** "Print" button is NOT visible.

### TC-M03: Print Label Action (#78)
**Steps:**
1. Open existing item
2. Click "Print" button

**Expected:** Toast: "Label sent to print queue." (Check browser console for print data object).

### TC-M04: Build Name — Combines Brand + Size + Measure (#79)
**Steps:**
1. Open New Item form
2. Select a Brand (e.g., "Coca-Cola")
3. Set Size = "12"
4. Set Units = "6", Measure = "Oz."
5. Click "Build Name" button

**Expected:** Name field is populated with "Coca-Cola 12 6 Oz." (or appended if name already has text).

### TC-M05: Build Name — Appends to Existing Name (#79)
**Steps:**
1. Type "Diet Soda" in the Name field
2. Select Brand = "Pepsi", Size = "2L"
3. Click "Build Name"

**Expected:** Name becomes "Diet Soda Pepsi 2L" (appended, not replaced).

### TC-M06: Build Name — No Duplicate Append (#79)
**Steps:**
1. Name already ends with the text that would be appended
2. Click "Build Name"

**Expected:** Name is not modified (doesn't duplicate the suffix).

---

## SECTION N: KEYBOARD SHORTCUTS

### TC-N01: F2 — General Tab
**Steps:**
1. Be on any tab
2. Press F2

**Expected:** Switches to General tab.

### TC-N02: F3 — Sales Tab
**Steps:** Press F3
**Expected:** Switches to Sales tab.

### TC-N03: F4 — Specials Tab
**Steps:** Press F4
**Expected:** Switches to Specials tab.

### TC-N04: F5 — Vendor Tab
**Steps:** Press F5
**Expected:** Switches to Vendor tab. (Note: Browser may try to reload — the handler calls `e.preventDefault()`).

### TC-N05: F6 — Extra Tab
**Steps:** Press F6
**Expected:** Switches to Extra tab.

---

## SECTION O: ORDERED IN / COST BY CASE TOGGLE (#50)

### TC-O01: Usually Ordered In = Cases → Auto-Check CostByCase (#50)
**Steps:**
1. CostByCase checkbox is unchecked
2. Change "Usually Ordered In" dropdown to "Cases"

**Expected:** CostByCase checkbox is automatically checked.

### TC-O02: CostByCase Toggle → Updates Ordered In
**Steps:**
1. Check CostByCase checkbox manually

**Expected:** "Usually Ordered In" changes to "Cases".

### TC-O03: Set Prices for Case → Updates Sold In
**Steps:**
1. Check "Set prices for case"

**Expected:** "Usually Sold In" changes to "Cases".

### TC-O04: Uncheck Set Prices for Case
**Steps:**
1. Uncheck "Set prices for case"

**Expected:** "Usually Sold In" changes to "Pieces".

---

## SECTION P: SAVE & NAVIGATION

### TC-P01: Save & Close — Success
**Steps:**
1. Fill all required fields with valid data
2. Click "Save & Close"

**Expected:** Toast: "Item saved successfully!" → After 1.5s, navigates to Item List.

### TC-P02: Save & New — Success
**Steps:**
1. Fill all required fields
2. Click "Save & New"

**Expected:** Toast: "Item saved successfully! You can add another item." Form resets to blank. Stays on General tab.

### TC-P03: Save — API Error Handling (#11/#12)
**Steps:**
1. Simulate a duplicate barcode error from the API (hard to reproduce manually unless you bypass client-side check)

**Expected:** If error contains "barcode" → "This barcode/UPC already exists in the system." If "duplicate" → "A duplicate value was detected."

### TC-P04: Edit Mode — Save Updates Item
**Steps:**
1. Open existing item
2. Change the Price
3. Click "Save & Close"

**Expected:** Toast: "Item updated successfully!" Item is updated in the database.

---

## SECTION Q: BACKEND API ENDPOINTS

### TC-Q01: ModelNumberExists API
**Steps:**
```
GET /api/Items/ModelNumberExists?modalNumber=EXISTING_NUMBER
```

**Expected:** `{ "isSuccess": true, "response": true }` if exists, `false` if not.

### TC-Q02: ModelNumberExists — With Exclude
**Steps:**
```
GET /api/Items/ModelNumberExists?modalNumber=EXISTING_NUMBER&excludeItemId=ITEM_GUID
```

**Expected:** Returns `false` if the only match is the excluded item.

### TC-Q03: ItemNameExists API
**Steps:**
```
GET /api/Items/ItemNameExists?name=EXISTING_NAME
```

**Expected:** `{ "isSuccess": true, "response": true }` if exists.

### TC-Q04: AliasBarcodeExists API
**Steps:**
```
GET /api/Items/AliasBarcodeExists?barcodeNumber=EXISTING_BARCODE
```

**Expected:** Returns `true` if barcode exists in ItemAlias OR ItemMain tables.

### TC-Q05: DepartmentDefaults API
**Steps:**
```
GET /api/Items/DepartmentDefaults/{departmentStoreId}
```

**Expected:** Returns `DepartmentDefaultsDto` with `defaultMarkup`, `roundUp`, `roundValue`, `isDefaultTaxInclude`, `isDefaultFoodStampable`, `isDefaultDiscountable`, etc.

### TC-Q06: DepartmentDefaults — Invalid ID
**Steps:**
```
GET /api/Items/DepartmentDefaults/00000000-0000-0000-0000-000000000000
```

**Expected:** 404 Not Found response.

---

## SECTION R: EDGE CASES & REGRESSION

### TC-R01: Rapid Department Switching
**Steps:**
1. Quickly switch departments 3 times in a row

**Expected:** Only the last department's defaults are applied. No stale confirmation dialogs.

### TC-R02: Save While Checking Barcode
**Steps:**
1. Type a barcode and immediately click Save (before blur check completes)

**Expected:** If barcode error hasn't been detected yet, save proceeds. If already detected, save is blocked.

### TC-R03: Empty Form Save
**Steps:**
1. Open New Item form
2. Don't fill anything
3. Click Save

**Expected:** First validation error: "Item name is required"

### TC-R04: Copy Item — Fields Populated
**Steps:**
1. From Item List, use "Copy Item" on an existing item
2. Check all tabs

**Expected:** All fields from the original item are copied. Barcode is empty (for new entry). Inventory fields reset to 0.

### TC-R05: Escape Key Closes Confirm Dialog
**Steps:**
1. Trigger any confirmation dialog
2. Press Escape key

**Expected:** Dialog closes with "cancel" result.

### TC-R06: Backdrop Click Closes Confirm Dialog
**Steps:**
1. Trigger any confirmation dialog
2. Click outside the dialog (on the dark backdrop)

**Expected:** Dialog closes with "cancel" result.

---

## Quick Reference: Feature → Test Cases Mapping

| # | Feature | Test Cases |
|---|---------|------------|
| 1-3 | Name/UPC required + barcode unique | TC-B10, TC-B11, TC-B12 |
| 4 | Department required | TC-B01 |
| 5 | Model number blocking | TC-A04, TC-A05 |
| 6-7 | Case Qty validations | TC-B04, TC-B05 |
| 8-9 | Cost>Price / Price=0 warnings | TC-B06–TC-B09 |
| 10 | Restock < Reorder | TC-B02, TC-B03 |
| 11-12 | Unique constraint errors | TC-P03 |
| 13-17 | Sale type validations | TC-C01–TC-C05 |
| 18-19 | Specials cost/price warnings | TC-B06–TC-B09 |
| 20 | Unsaved changes on cancel | TC-G01–TC-G07 |
| 21-22 | Department markup + roundup | TC-E03–TC-E05 |
| 23 | Multi-store save confirm | TC-F01–TC-F04 |
| 24 | Matrix confirmation | TC-L01–TC-L05 |
| 25-26 | Supplier/alias confirmations | TC-H01–TC-H06, TC-I01–TC-I03 |
| 39-41 | Specials margin/markup | TC-K08–TC-K10 |
| 42-43 | Lock markup + roundup | TC-K04, TC-K07, TC-E05 |
| 48 | Lock Markup toggle | TC-K04, TC-K05 |
| 50 | OrderedIn → CostByCase | TC-O01–TC-O04 |
| 51-54 | Sale type toggle behaviors | TC-D01–TC-D06 |
| 55 | Dept defaults auto-set | TC-E01, TC-E02 |
| 64 | View permission | TC-J01 |
| 66-68 | Inline validations | TC-A01–TC-A11 |
| 69 | Future pricing date | TC-C06, TC-C07 |
| 72-73 | Store switch unsaved | TC-F05–TC-F09 |
| 75 | Matrix support | TC-L01–TC-L05 |
| 76 | Supplier remove confirm | TC-H04, TC-H05 |
| 78 | Print label | TC-M01–TC-M03 |
| 79 | Add text to name | TC-M04–TC-M06 |
