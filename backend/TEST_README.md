# API Test Suite - Comprehensive Endpoint Testing

## Overview
This test suite provides interactive command-line testing for all Medora backend endpoints (excluding AI endpoints). The suite guides you through each workflow with prompts for phone numbers and OTPs.

## Files
- **test.js** - Main comprehensive test file
- **test.pdf** - Sample PDF for hospital document uploads
- **test2.pdf** - Sample PDF for patient document uploads

## Features

### 1. **Interactive CLI Input**
- Prompts for phone numbers
- Asks for OTP codes (with default `000000` for development)
- Guides you through each authentication flow

### 2. **Automatic Token Fetching**
- Handles OTP verification automatically
- Stores and manages JWT tokens for each role
- Passes tokens to subsequent API calls

### 3. **Test Scenarios**

#### Scenario 1: Patient Flow
- Patient sign up with OTP
- Create folders
- Upload documents to folders
- Fetch records by user ID
- Delete records
- Delete folder files
- Patient sign out

#### Scenario 2: Hospital Flow
- Hospital registration with OTP
- Add patients to hospital
- Add doctors to hospital
- Fetch hospital patients and doctors
- Upload patient records
- Fetch hospital full information
- Delete patient documents
- Hospital sign out

#### Scenario 3: Doctor Flow
- Hospital registration (required first)
- Add doctor to hospital
- Doctor login with OTP
- Fetch doctor profile
- Doctor sign out

#### Scenario 4: Complete Flow
- All three roles (Patient + Hospital + Doctor)
- Full interaction between all entities
- Complete CRUD operations

## How to Run

### Prerequisites
```bash
# Ensure your backend server is running
npm start
# Server should be running on http://localhost:5000
```

### Run Tests
```bash
# From the backend directory
node test.js
```

### Menu Selection
```
Choose test scenario:
1. Patient Flow
2. Hospital Flow
3. Doctor Flow
4. Complete Flow
5. Exit
```

## Sample Data Used

### Default OTP (Development)
- Use `000000` or leave blank when prompted

### Patient Signup
```
Phone: +919876543210
First Name: John
Last Name: Doe
```

### Hospital Signup
```
Phone: +919876543210
Name: Apollo Hospital
Address: Mumbai, India
```

### Doctor Registration
```
Name: Dr. Rajesh Kumar
Phone: +919876543211
Specialization: Cardiology
License: DOC12345
```

## Endpoint Coverage

### Authentication
- ✅ POST /auth/signup/send-otp
- ✅ POST /auth/signup/verify-otp
- ✅ POST /auth/signin/send-otp
- ✅ POST /auth/signin/verify-otp
- ✅ POST /auth/signout
- ✅ POST /hospital/send-otp
- ✅ POST /hospital/verify-otp
- ✅ POST /hospital/signout
- ✅ POST /doctor/signin/send-otp
- ✅ POST /doctor/signin/verify-otp
- ✅ POST /doctor/signout

### Patient Management
- ✅ POST /folders/create
- ✅ GET /folders
- ✅ DELETE /folders/:folder_id
- ✅ POST /records/upload (patient)
- ✅ GET /records/user/:userId
- ✅ DELETE /records/:record_id
- ✅ DELETE /folders/:folder_id/files/:record_id

### Hospital Management
- ✅ POST /hospital/doctors/add
- ✅ GET /hospital/doctors
- ✅ DELETE /hospital/doctors/:doctor_id
- ✅ POST /hospital/patients/add
- ✅ GET /hospital/patients
- ✅ DELETE /hospital/patients/:patient_id
- ✅ POST /hospital/patients/:phone/records (upload)
- ✅ DELETE /hospital/patients/:patient_id/documents
- ✅ GET /hospital/info

### Doctor Management
- ✅ GET /doctor/profile

## Example Test Run

```
Choose test scenario:
1. Patient Flow
2. Hospital Flow
3. Doctor Flow
4. Complete Flow
5. Exit

Enter choice (1-5): 1

════════════════════════════════════════════════════════════════════════════════
PHASE 1: PATIENT AUTHENTICATION
════════════════════════════════════════════════════════════════════════════════

📱 Enter patient phone (e.g., +919876543210): +919876543210
👤 Enter first name: John
👤 Enter last name: Doe

📨 Sending OTP...
✅ OTP sent successfully!

🔐 Enter OTP received (default dev OTP: 000000): 
(Press Enter to use default)

🔍 Verifying OTP...
✅ Patient signed up successfully!
   Name: John Doe
   Phone: +919876543210
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

════════════════════════════════════════════════════════════════════════════════
PHASE 2: PATIENT - FOLDER MANAGEMENT
════════════════════════════════════════════════════════════════════════════════

📁 Creating folder...
✅ Create Folder - PASSED
   Folder ID: 550e8400-e29b-41d4-a716-446655440000

📂 Fetching all folders...
✅ Get Folders - PASSED
   Total folders: 1

════════════════════════════════════════════════════════════════════════════════
PHASE 2: PATIENT - RECORD UPLOAD & MANAGEMENT
════════════════════════════════════════════════════════════════════════════════

📄 Uploading record to folder...
✅ Upload Record - PASSED
   Record ID: 660e8400-e29b-41d4-a716-446655440001

📊 Fetching records by user ID...
✅ Get Records by User ID - PASSED
   Total records: 1

🗑️ Deleting record...
✅ Delete Record - PASSED

════════════════════════════════════════════════════════════════════════════════
PHASE 5: SIGNOUT ENDPOINTS
════════════════════════════════════════════════════════════════════════════════

👤 Patient signout...
✅ Patient Signout - PASSED

👋 Exiting test suite
```

## Notes

- **Development Mode**: OTP verification uses mock values (`000000` or `123456`)
- **Production Mode**: Real SMS via Twilio will be sent
- **Token Management**: Tokens are automatically stored and passed with each request
- **Sample Data**: Use any valid phone format, names and details can be anything
- **File Uploads**: Uses test.pdf (hospital) and test2.pdf (patient) which are valid PDF files

## Error Handling

The test suite includes comprehensive error handling:
- Invalid OTP will show error message
- Missing patients will show appropriate error
- Network errors will be displayed with details
- All test results show PASS/FAIL status

## Testing Tips

1. **For Complete Flow**: Use different phone numbers for patient and hospital for realistic testing
2. **For Doctor Flow**: Hospital must be registered first before adding/logging in doctor
3. **For Record Testing**: Ensure patient is added to hospital before uploading hospital records
4. **OTP Input**: Just press Enter to use the default development OTP (000000)
