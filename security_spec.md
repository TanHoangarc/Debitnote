# Security Specification: Logi-Note Manager Firebase Rules

## 1. Data Invariants
- Each custom `Customer` entry must contain a unique ID, non-empty `name`, a valid logistics `taxId`, and full `address` for billing.
- Each custom `Fee` entry must define a valid `description`, decimal/fractional `vatPercent` (0 to 100), and boolean `isPayOnBehalf`.
- Each `DebitNote` (history entry) must carry a non-empty `companyName` and link to an array of valid structured charges. IDs must consist of alpha-numeric and simple safe characters.

## 2. The "Dirty Dozen" (Malicious Payloads to Reject)
1. **Invalid Document ID Injection**: Attempt to create custom customer with ID "/../hack" or non-escaped strings containing special characters or >128 chars.
2. **Missing Customer Billing Data**: Customer record payload missing required `taxId` property.
3. **Ghost Fields Injection**: Adding unverified status field `isAdminApproved: true` to a Customer document.
4. **Incorrect Customer Property Type**: Schema mismatch where `taxId` is passed as a number instead of a string.
5. **Customer Name Overflow**: Injecting a 1MB string into the `name` field of a customer.
6. **Missing Fee Details**: Fee record payload missing the flag `isPayOnBehalf`.
7. **Invalid Fee Type**: Fee record with `vatPercent` passed as an object instead of int or float.
8. **Malicious Empty Name**: Creating a fee with description `""` or whitespace-only character strings.
9. **No-Charge Debit Note Integrity**: Creation of a debit note where charges is an invalid string or raw text instead of a list.
10. **Exchange Rate Malformation**: ROE value passed as a massive malicious string instead of a valid numeric value.
11. **Huge Note Field**: Notes block containing >2,000 characters to bloat database storage limits and trigger high resource cost.
12. **Tampered Global Sandbox Paths**: Attempting to write documents to nested collections outside the mapped schema boundaries.
