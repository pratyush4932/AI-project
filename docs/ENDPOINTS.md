# 🏥 Medora Backend API Documentation

Welcome to the **Medora API**. This documentation provides front-end developers with detailed specifications, sample inputs, and expected outputs for all available endpoints.

* **Base URL**: `http://localhost:6363` (or your deployed URL)
* **Authentication**: All protected routes require a Bearer token: `Authorization: Bearer <TOKEN>`
* **OTP Note**: During development, the default OTP is `000000`.

---

## 📋 Table of Contents

- [1. Patient Authentication (Users)](#1-patient-authentication-users)
- [2. Patient Endpoints (Folders & Records)](#2-patient-endpoints-folders--records)
- [3. Hospital Authentication](#3-hospital-authentication)
- [4. Hospital Management Endpoints](#4-hospital-management-endpoints)
- [5. Doctor Authentication & Endpoints](#5-doctor-authentication--endpoints)
- [6. AI Analysis Endpoints](#6-ai-analysis-endpoints)

---

## 1. Patient Authentication (Users)
**Route Base**: `/auth`

Patients use these endpoints to sign up, sign in, and manage their sessions.

### `POST /auth/signup/send-otp`
Initiates a new patient registration by sending an OTP.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+919876543210",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "OTP sent successfully"
  }
  ```

### `POST /auth/signup/verify-otp`
Verifies the OTP and creates the patient account, returning an auth token.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+919876543210",
    "firstName": "John",
    "lastName": "Doe",
    "otp": "000000"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210",
      "role": "patient"
    },
    "token": "eyJhbGciOiJIUzI1..."
  }
  ```

### `POST /auth/signin/send-otp`
Initiates login for an existing patient.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+919876543210"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "OTP sent successfully"
  }
  ```

### `POST /auth/signin/verify-otp`
Verifies OTP for a returning patient and issues a token.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+919876543210",
    "otp": "000000"
  }
  ```
* **Success Response (200 OK)**: *(Same as Registration Response)*

### `POST /auth/signout`
Logs the patient out (Invalidates token if implemented, clears session).
* **Headers**: `Authorization: Bearer <patient_token>`
* **Success Response (200 OK)**:
  ```json
  { "message": "Signed out successfully" }
  ```

---

## 2. Patient Endpoints (Folders & Records)
**Folder Route Base**: `/folders`
**Record Route Base**: `/records`

### `POST /folders/create`
Creates a custom folder for the patient to organize their documents.
* **Headers**: `Authorization: Bearer <patient_token>`
* **Request Body (JSON)**:
  ```json
  {
    "name": "Blood Tests"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Folder created successfully",
    "folder": {
      "id": "uuid",
      "name": "Blood Tests",
      "user_id": "uuid"
    }
  }
  ```

### `GET /folders`
Fetches all folders created by the patient.
* **Headers**: `Authorization: Bearer <patient_token>`
* **Success Response (200 OK)**:
  ```json
  {
    "folders": [
      {
        "id": "uuid",
        "name": "Blood Tests",
        "created_at": "2026-04-17T12:00:00Z"
      }
    ]
  }
  ```

### `POST /records/upload`
Uploads a medical record file (PDF/Image). Depending on the body, it goes to their personal folder or a hospital's section.
* **Headers**: `Authorization: Bearer <patient_token>`
* **Request Body (`multipart/form-data`)**:
  - `file`: (Binary File, e.g., result.pdf)
  - `folder_id`: *(Optional)* UUID of a personal folder to store in.
  - `hospital_id`: *(Optional)* UUID of a hospital (If passed, it uploads securely to the hospital's view for this patient).
* **Success Response (201 Created)**:
  ```json
  {
    "record": {
      "id": "uuid",
      "file_url": "https://storage.supabase.co/...",
      "file_type": "application/pdf",
      "source": "patient", // or "hospital" if hospital_id was passed
      "ai_summary": {}, // Populated automatically for hospital uploads
      "created_at": "2026-04-17T12:00:00Z"
    }
  }
  ```
* **AI Note**: If `hospital_id` is provided (Hospital Upload), an AI summarization job is automatically triggered. The `ai_summary` field will be updated asynchronously once processing is complete. If the file has been processed before, the summary is returned immediately from the cache.

### `GET /records/user/:userId`
Gets all records logically grouped by Folders and Hospital Visits.
* **Headers**: `Authorization: Bearer <patient_token>`
* **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210"
    },
    "records_view": {
      "folders": [
        {
          "id": "uuid",
          "name": "Blood Tests",
          "records": [
             {
               "id": "uuid",
               "file_url": "https://...",
               "file_type": "application/pdf",
               "ai_summary": {} 
             }
          ]
        }
      ]
    },
    "hospital_view": [
       {
         "hospital_id": "uuid",
         "hospital_name": "Apollo Hospital",
         "visits": [
            {
              "date": "2026-04-17",
              "records": [] 
            }
         ]
       }
    ]
  }
  ```

### `GET /records/user/phone/:phone`
Similar to the user ID route above, but fetches using the user's phone number directly.
* **Headers**: `Authorization: Bearer <patient_token>`

### `DELETE /records/:record_id`
Deletes a specific record.
* **Headers**: `Authorization: Bearer <patient_token>` OR `Authorization: Bearer <hospital_token>`
* **Success Response (200 OK)**:
  ```json
  { "message": "Record deleted successfully" }
  ```
* **Permissions**: Patients can delete their own records. Hospitals can delete any records that were uploaded to their hospital section (matching their `hospital_id`).

---

## 3. Hospital Authentication
**Route Base**: `/hospital`

### `POST /hospital/send-otp`
Initiates hospital registration or login.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+918240509018"
  }
  ```

### `POST /hospital/verify-otp`
Verifies OTP for a hospital. If the hospital doesn't exist, it creates one (registration).
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+918240509018",
    "name": "Apollo Hospital",
    "address": "123 Health Street",
    "otp": "000000"
  }
  ```
* **Success Response (200 OK / 201 Created)**:
  ```json
  {
    "message": "Hospital authenticated successfully",
    "hospital": {
      "id": "uuid",
      "name": "Apollo Hospital",
      "phone": "+918240509018"
    },
    "token": "eyJhbGciOi..."
  }
  ```

### `POST /hospital/signout`
* **Headers**: `Authorization: Bearer <hospital_token>`

---

## 4. Hospital Management Endpoints
**Route Base**: `/hospital`
*(All routes here require `Authorization: Bearer <hospital_token>`)*

### `POST /hospital/patients/add`
Links an existing patient to this hospital via phone number.
* **Request Body (JSON)**:
  ```json
  { "phone": "+919876543210" }
  ```
* **Success Response (200 OK / 201 Created)**:
  ```json
  {
    "message": "Patient added to hospital",
    "patient": { "id": "uuid", "name": "John Doe", "phone": "+919876543210" }
  }
  ```

### `GET /hospital/patients`
Gets a list of all patients assigned to this hospital.
* **Success Response (200 OK)**:
  ```json
  {
    "total": 1,
    "patients": [
      {
         "id": "uuid",
         "name": "John Doe",
         "phone": "+919876543210",
         "joined_at": "2026-04-17T12:00:00Z"
      }
    ]
  }
  ```

### `DELETE /hospital/patients/:patient_id`
Unlinks a patient from the hospital completely.
* **Success Response (200 OK)**: `{ "message": "Patient removed successfully" }`

### `DELETE /hospital/patients/:patient_id/documents`
Permanently deletes all documents/records specific to this hospital for this patient.
* **Success Response (200 OK)**: `{ "message": "All documents for this patient deleted successfully" }`

### `POST /hospital/doctors/add`
Adds a doctor to the hospital. If they don't exist in Medora yet, it creates their account so they can sign in independently later.
* **Request Body (JSON)**:
  ```json
  {
    "name": "Dr. Smith",
    "phone": "+917551807558",
    "specialization": "Cardiology",
    "license_no": "DOC12345" // (Optional fallback)
  }
  ```
* **Success Response (200 OK / 201 Created)**:
  ```json
  {
    "doctor": {
      "id": "uuid",
      "name": "Dr. Smith",
      "phone": "+917551807558",
      "specialization": "Cardiology",
      "message": "Doctor already exists and has been successfully linked to the hospital."
    }
  }
  ```

### `GET /hospital/doctors`
Gets all doctors linked to this hospital.
* **Success Response (200 OK)**:
  ```json
  {
    "total": 1,
    "doctors": [
      { "id": "uuid", "name": "Dr. Smith", "phone": "+91...", "specialization": "Cardiology" }
    ]
  }
  ```

### `DELETE /hospital/doctors/:doctor_id`
Unlinks a doctor from the hospital.
* **Success Response (200 OK)**: `{ "message": "Doctor removed successfully" }`

### `POST /hospital/patients/:phone/records`
Allows a hospital receptionist or admin to upload a medical file for a patient directly to the hospital's view.
* **Headers**: `multipart/form-data`
  - `file`: (Binary File)
  - `visit_date`: *(Optional)* "2026-04-17" (Defaults to today)
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Record uploaded successfully",
    "record": {
      "id": "uuid",
      "patient_name": "John Doe",
      "file_url": "https://...",
      "visit_date": "2026-04-17",
      "ai_summary": {} // Populated asynchronously
    }
  }
  ```
* **AI Note**: Hospital uploads automatically trigger the AI summarization pipeline. The record will be updated with the `ai_summary` once the background job completes.

### `GET /hospital/info`
A **massive aggregate endpoint** pulling all doctors and all patients (including fully populated visit chronologies and AI summarized records) linked to the hospital.
* **Success Response (200 OK)**:
  ```json
  {
    "hospital": { "id": "uuid", "name": "Apollo Hospital" },
    "staff": [
       { "user_id": "uuid", "name": "Dr. Smith", "specialization": "Cardiology" }
    ],
    "patients": [
       {
         "user_id": "uuid",
         "name": "John Doe",
         "visits": [
           { 
              "date": "2026-04-17", 
               "records": [ { "id": "uuid", "file_url": "...", "ai_summary": {} } ] 
           }
         ]
       }
    ]
  }
  ```

---

## 5. Doctor Authentication & Endpoints
**Route Base**: `/doctor`

Doctors sign in independently, but they **must have been added by a hospital first**.

### `POST /doctor/signin/send-otp`
Sends an OTP to an existing doctor to sign in.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+917551807558"
  }
  ```
* **Notes**: If the phone is not a registered doctor, it returns an error.

### `POST /doctor/signin/verify-otp`
Verifies the OTP and signs the doctor into their session.
* **Request Body (JSON)**:
  ```json
  {
    "phone": "+917551807558",
    "otp": "000000"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Doctor authenticated successfully",
    "doctor": {
      "id": "uuid",
      "name": "Dr. Smith",
      "hospital_name": "Apollo Hospital" // Or null
    },
    "token": "eyJhbG..."
  }
  ```

### `GET /doctor/profile`
* **Headers**: `Authorization: Bearer <doctor_token>`
* **Success Response (200 OK)**: Returns the current doctor's profile and linked hospital data.

### `POST /doctor/signout`
* **Headers**: `Authorization: Bearer <doctor_token>`

---

## 6. AI Analysis Endpoints
**Route Base**: `/ai`

The AI pipeline analyzes medical documents (PDFs, Images, DOCX) using Google's `gemini-2.5-flash` natively for Vision/OCR processing. Processing is handled asynchronously via a background queue (BullMQ/Redis) with automatic caching for duplicate files.

### `POST /ai/summarize`
Initiates summarization of one or more medical documents.
* **Headers**: `Content-Type: multipart/form-data`
* **Body**:
  - `documents`: (File Array, Max 3 files) - Supported: PDF, JPG, PNG, DOCX.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "fileName": "report.pdf",
        "success": true,
        "message": "Processing started",
        "jobId": "123"
      },
      {
        "fileName": "old_report.pdf",
        "fromCache": true,
        "is_medical_document": true,
        "complaints": ["Dry cough"],
        "medications": [{"name": "Amoxicillin", "dosage": "500mg", "frequency": "TID"}],
        "findings": ["Clear lungs"],
        "reports": ["Chest X-Ray"],
        "diagnosis": ["Bronchitis"],
        "simple_summary": "Patient has a mild cough, prescribed antibiotics.",
        "ai_model_source": "gemini-2.5-flash"
      }
    ],
    "message": "Processing initiated."
  }
  ```
* **Notes**: 
  - If a file has been processed before (matching hash), it returns the cached result immediately (indicated by `"fromCache": true`).
  - For new files, it returns a `jobId` to poll for status via the `/ai/status/:jobId` endpoint.

### `GET /ai/status/:jobId`
Checks the status of a background summarization job.
* **Params**: `jobId` (from the summarize response)
* **Success Response (200 OK - Completed)**:
  ```json
  {
    "success": true,
    "state": "completed",
    "data": {
      "fileName": "report.pdf",
      "is_medical_document": true,
      "complaints": [],
      "medications": [],
      "findings": [],
      "reports": [],
      "diagnosis": [],
      "simple_summary": "...",
      "ai_model_source": "gemini-2.5-flash"
    }
  }
  ```
* **Success Response (200 OK - Processing)**:
  ```json
  {
    "success": true,
    "state": "active",
    "progress": 50
  }
  ```
* **Failure Response (200 OK - Failed)**:
  ```json
  {
    "success": false,
    "state": "failed",
    "error": "Reason for failure"
  }
  ```

### `POST /ai/summarize-summaries`
Aggregates multiple individual document summaries into a unified longitudinal health profile.
* **Headers**: `Content-Type: application/json`
* **Body (JSON)**:
  ```json
  {
    "summaryData": [
      { "complaints": [...], "medications": [...], ... },
      { "complaints": [...], "medications": [...], ... }
    ]
  }
  ```
* **Constraints**: Maximum 10 summaries per request.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "overall_health_picture": "The patient shows a history of recurring respiratory issues...",
      "identified_patterns": [
        "Seasonal allergies leading to asthma flare-ups",
        "Consistent response to bronchodilators"
      ],
      "summary_count": 2
    },
    "message": "Successfully aggregated summaries."
  }
  ```


---
> **General Testing Note:** All endpoints gracefully return errors in the format `{ "error": "Clear explanation message", "action": "Optional hint" }` accompanied by the proper HTTP codes (400, 401, 403, 404, 409). Make sure to parse `error.response.data.error` in Axios/Fetch `catch` blocks for smooth UI toasts!
