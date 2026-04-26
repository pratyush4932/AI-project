# API Contract - Medora Backend

AUTH:
POST /auth/signup/send-otp
Description: Sends OTP for user registration.
Request:
Body: { "firstName": "string", "lastName": "string", "phone": "string", "name": "string" }
Headers: none
Response:
{ "message": "string" }
Auth: public

---

POST /auth/signup/verify-otp
Description: Verifies OTP and registers a new user.
Request:
Body: { "firstName": "string", "lastName": "string", "phone": "string", "otp": "string", "name": "string" }
Headers: none
Response:
{ "token": "string", "user": { "id": "string", "phone": "string", "role": "string", "name": "string" } }
Auth: public

---

POST /auth/signin/send-otp
Description: Sends OTP for user login.
Request:
Body: { "phone": "string" }
Headers: none
Response:
{ "message": "string" }
Auth: public

---

POST /auth/signin/verify-otp
Description: Verifies OTP and logs in user.
Request:
Body: { "phone": "string", "otp": "string" }
Headers: none
Response:
{ "token": "string", "user": { "id": "string", "phone": "string", "role": "string", "name": "string" } }
Auth: public

---

POST /auth/signout
Description: Signs out the patient.
Request:
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string", "note": "string" }
Auth: requires JWT

---

RECORDS:
POST /records/upload
Description: Uploads a medical record for a patient or hospital.
Request:
Body: multipart/form-data
Fields:
- file: (PDF/Image/DOCX)
- folder_id: string (optional)
- hospital_id: string (optional)
Headers: 
- Authorization: Bearer <token>
Response:
{ "record": { "id": "string", "user_id": "string", "file_type": "string", "uploaded_by": "string", "folder_id": "string", "hospital_id": "string", "visit_date": "string", "source": "string", "file_url": "string" } }
Auth: requires JWT
Special Notes:
- File upload
- Uses multipart/form-data

---

GET /records/user/:userId
Description: Gets all records for a specific user ID grouped by folder and hospital.
Request:
URL params: userId
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "user": { "id": "string", "name": "string", "phone": "string", "role": "string", "created_at": "string" }, "records_view": { "folders": [ { "id": "string", "name": "string", "records": [] } ] }, "hospital_view": [ { "hospital_id": "string", "hospital_name": "string", "visits": [ { "date": "string", "records": [] } ] } ] }
Auth: requires JWT

---

GET /records/user/phone/:phone
Description: Gets all records for a specific user phone grouped by folder and hospital.
Request:
URL params: phone
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "user": { "id": "string", "name": "string", "phone": "string", "role": "string", "created_at": "string" }, "records_view": { "folders": [ { "id": "string", "name": "string", "records": [] } ] }, "hospital_view": [ { "hospital_id": "string", "hospital_name": "string", "visits": [ { "date": "string", "records": [] } ] } ] }
Auth: requires JWT

---

DELETE /records/:record_id
Description: Deletes a specific medical record.
Request:
URL params: record_id
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string" }
Auth: requires JWT
Special Notes:
- Must own the record or be the authorized hospital

---

QR:
POST /qr/generate
Description: Generates a time-limited, scoped QR token mapped to specific records.
Request:
Body: { "record_ids": ["string"], "expires_in": "number" }
Headers: 
- Authorization: Bearer <token>
Response:
{ "token": "string", "expires_at": "string", "message": "string" }
Auth: requires JWT
Special Notes:
- Generates high-entropy UUIDv4 token
- Token default expiration is 15 mins (900s), limits 5m - 24h

---

GET /qr/:token
Description: Dynamically fetches records bound to the UUIDv4 token.
Request:
URL params: token
Body: none
Headers: none
Response:
{ "patient": { "id": "string", "name": "string" }, "records": [ { "id": "string", "file_type": "string", "created_at": "string", "source": "string", "file_url": "string", "ai_summary": {} } ], "expires_at": "string", "message": "string" }
Auth: public (Token acts as auth inherently)
Special Notes:
- Validates token expiry date
- Provides short-lived signed URLs (10 mins) for secure access

---

AI:
POST /ai/summarize
Description: Initiates document summarization and returns a job ID.
Request:
Body: multipart/form-data
Fields:
- documents: (Array of PDF/Image/DOCX, max 3 files)
Headers: none
Response:
{ "success": true, "data": [ { "fileName": "string", "success": true, "message": "string", "jobId": "string" } ], "message": "string" }
Auth: public
Special Notes:
- File upload
- Uses multipart/form-data
- Checks cache, if not present adds to DB queue

---

POST /ai/summarize-summaries
Description: Aggregates multiple medical summaries into a unified health profile.
Request:
Body: { "summaryData": [{}] }
Headers: none
Response:
{ "success": true, "data": { "overall_health_picture": "string", "identified_patterns": ["string"], "summary_count": "number" }, "message": "string" }
Auth: public

---

GET /ai/status/:jobId
Description: Checks the status of a queued AI summarization job.
Request:
URL params: jobId
Body: none
Headers: none
Response:
{ "success": true, "state": "string", "progress": "number", "data": {}, "error": "string" }
Auth: public

---

HOSPITAL:
POST /hospital/send-otp
Description: Sends OTP for hospital registration/login.
Request:
Body: { "phone": "string" }
Headers: none
Response:
{ "message": "string" }
Auth: public

---

POST /hospital/verify-otp
Description: Verifies OTP for hospital and logs in or registers.
Request:
Body: { "phone": "string", "otp": "string", "name": "string", "address": "string", "license_no": "string" }
Headers: none
Response:
{ "token": "string", "hospital": { "id": "string", "name": "string", "phone": "string", "role": "string", "is_new": true } }
Auth: public

---

POST /hospital/signout
Description: Signs out the hospital user.
Request:
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string" }
Auth: requires JWT

---

POST /hospital/doctors/add
Description: Adds a new doctor to the hospital.
Request:
Body: { "name": "string", "phone": "string", "specialization": "string", "license_no": "string" }
Headers: 
- Authorization: Bearer <token>
Response:
{ "doctor": { "id": "string", "name": "string", "phone": "string", "specialization": "string", "hospital_id": "string", "message": "string" } }
Auth: requires JWT

---

GET /hospital/doctors
Description: Gets all doctors linked to the hospital.
Request:
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "hospital_id": "string", "total": "number", "doctors": [ { "id": "string", "name": "string", "phone": "string", "specialization": "string", "license_no": "string", "status": "string", "created_at": "string" } ] }
Auth: requires JWT

---

DELETE /hospital/doctors/:doctor_id
Description: Deletes a doctor from the hospital.
Request:
URL params: doctor_id
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string" }
Auth: requires JWT

---

POST /hospital/patients/add
Description: Adds an existing patient to the hospital.
Request:
Body: { "phone": "string" }
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string", "patient": { "id": "string", "name": "string", "phone": "string", "role": "string" }, "hospital_id": "string" }
Auth: requires JWT

---

GET /hospital/patients
Description: Gets all patients linked to the hospital.
Request:
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "hospital_id": "string", "total": "number", "patients": [ { "id": "string", "name": "string", "phone": "string", "status": "string", "added_at": "string" } ] }
Auth: requires JWT

---

DELETE /hospital/patients/:patient_id
Description: Removes a patient from the hospital.
Request:
URL params: patient_id
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string" }
Auth: requires JWT

---

DELETE /hospital/patients/:patient_id/documents
Description: Deletes all documents of a patient in the hospital.
Request:
URL params: patient_id
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string" }
Auth: requires JWT

---

POST /hospital/patients/:phone/records
Description: Uploads a medical record for a specific patient.
Request:
URL params: phone
Body: multipart/form-data
Fields:
- file: (PDF/Image/DOCX)
- visit_date: string (optional)
Headers: 
- Authorization: Bearer <token>
Response:
{ "message": "string", "record": { "id": "string", "patient_name": "string", "patient_phone": "string", "file_url": "string", "file_type": "string", "visit_date": "string", "uploaded_at": "string" } }
Auth: requires JWT
Special Notes:
- File upload
- Uses multipart/form-data
- Triggers AI summarization queue

---

GET /hospital/info
Description: Gets complete hospital information including staff and patients.
Request:
Body: none
Headers: 
- Authorization: Bearer <token>
Response:
{ "hospital": { "id": "string", "name": "string", "created_at": "string" }, "staff": [ { "user_id": "string", "name": "string", "phone": "string", "role": "string" } ], "patients": [ { "user_id": "string", "name": "string", "phone": "string", "visits": [ { "date": "string", "records": [] } ] } ] }
Auth: requires JWT
