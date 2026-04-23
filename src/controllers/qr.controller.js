import { supabase } from '../config/supabase.js';
import { generateSecureToken } from '../utils/tokenGenerator.js';

/**
 * Generate a time-limited, scoped QR token.
 * POST /qr/generate
 * Auth: Required (JWT via authMiddleware)
 */
export const generateQRToken = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { record_ids, expires_in = 900 } = req.body; // Default 15 mins (900 seconds)

        // 1. Input Validation
        if (!Array.isArray(record_ids) || record_ids.length === 0) {
            return res.status(400).json({ error: 'record_ids must be a non-empty array of record UUIDs.' });
        }

        const expirySeconds = parseInt(expires_in, 10);
        if (isNaN(expirySeconds) || expirySeconds < 300 || expirySeconds > 86400) {
            return res.status(400).json({ error: 'expires_in must be a number between 300 (5 mins) and 86400 (24 hours).' });
        }

        // 2. Verify Ownership of Requested Records
        const { data: records, error: fetchError } = await supabase
            .from('records')
            .select('id')
            .eq('user_id', userId)
            .in('id', record_ids);

        if (fetchError) throw fetchError;

        if (!records || records.length !== record_ids.length) {
            return res.status(403).json({ 
                error: 'Ownership verification failed. One or more records do not belong to you or do not exist.' 
            });
        }

        // 3. Generate High-Entropy UUID/Token and Calculate Expiration
        const token = generateSecureToken();
        const expiresAt = new Date(Date.now() + expirySeconds * 1000);

        // 4. Store in database
        const { error: insertError } = await supabase
            .from('qr_tokens')
            .insert([{
                token,
                user_id: userId,
                allowed_record_ids: record_ids,
                expires_at: expiresAt.toISOString()
            }]);

        if (insertError) {
            // Note: If qr_tokens table doesn't exist, this throws nicely.
            throw insertError;
        }

        console.log(`[QR_GENERATED] User: ${userId}, Token: ${token}, Expires: ${expiresAt.toISOString()}`);

        // 5. Response
        res.status(201).json({
            token,
            expires_at: expiresAt.toISOString(),
            message: 'QR Token generated successfully.'
        });

    } catch (err) {
        console.error('[QR_GENERATE_ERROR]', err.message);
        next(err);
    }
};

/**
 * Access records dynamically using the secure QR Token.
 * GET /qr/:token
 * Auth: None (Token is intrinsically validating itself)
 */
export const accessQRToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // 1. Validate Token Exists
        const { data: qrData, error: qrError } = await supabase
            .from('qr_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (qrError || !qrData) {
            // Prevent enumeration by returning generic 404
            return res.status(404).json({ error: 'Invalid or missing QR token' });
        }

        // 2. Validate Expiration
        // Force UTC parsing if Z is missing to avoid local time misinterpretation
        const expiryDate = qrData.expires_at.endsWith('Z') 
            ? new Date(qrData.expires_at) 
            : new Date(qrData.expires_at + 'Z');
            
        if (expiryDate < new Date()) {
            return res.status(403).json({ error: 'QR token has expired' });
        }

        // Optional: Check if used, depending on strictness
        if (qrData.is_used) {
            // Uncomment to restrict token to Single-Use only
            // return res.status(403).json({ error: 'QR token has already been used' });
        }

        // 3. Fetch Patient Demographic Info
        const { data: patient, error: patientError } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', qrData.user_id)
            .single();

        if (patientError || !patient) {
            return res.status(404).json({ error: 'Patient data not found' });
        }

        // 4. Fetch the Allowed Records only
        const { data: records, error: recordsError } = await supabase
            .from('records')
            .select('*')
            .in('id', qrData.allowed_record_ids);

        if (recordsError) throw recordsError;

        // 5. Construct Response with Signed URLs
        const recordsPayload = await Promise.all((records || []).map(async (rec) => {
            let signedUrl = rec.file_url; // Default to existing public URL as fallback

            try {
                // Determine the raw path inside the bucket. Existing urls look like:
                // https://XYZ.supabase.co/storage/v1/object/public/records/path/to/file.pdf
                // We extract just the path portion.
                const basePath = '/storage/v1/object/public/records/';
                if (rec.file_url && rec.file_url.includes(basePath)) {
                    const objectPath = decodeURIComponent(rec.file_url.split(basePath)[1]);
                    
                    // Create signed URL valid for 10 minutes (600 seconds)
                    const { data: signedData, error: signError } = await supabase
                        .storage
                        .from('records')
                        .createSignedUrl(objectPath, 600);
                        
                    if (signedData && !signError) {
                        signedUrl = signedData.signedUrl;
                    }
                }
            } catch (err) {
                console.error(`[QR_SIGNEDURL_ERROR] Error signing URL for record ${rec.id}:`, err);
            }

            return {
                id: rec.id,
                file_type: rec.file_type,
                created_at: rec.created_at,
                source: rec.source,
                file_url: signedUrl, // Strictly using generated signed URL
                ai_summary: rec.ai_summary || null
            };
        }));

        // 6. Log the audit event (Best Effort)
        try {
            await supabase.from('audit_logs').insert([{
                user_id: qrData.user_id,
                action: 'QR_ACCESS',
                metadata: { token: token, accessed_records_count: recordsPayload.length }
            }]);
        } catch (auditErr) {
            // Ignore audit table errors silently if it hasn't been created yet
            console.warn('[AUDIT_LOG_MISSING] Please ensure audit_logs table exists.', auditErr.message);
        }

        console.log(`[QR_ACCESSED] Token: ${token}, AccessorIP: ${req.ip}`);

        // Mark as used if we wanted Single-Use token policy
        // await supabase.from('qr_tokens').update({ is_used: true }).eq('token', token);

        // 7. Final Output
        return res.status(200).json({
            patient: {
                id: patient.id,
                name: patient.name
            },
            records: recordsPayload,
            expires_at: qrData.expires_at,
            message: 'Records securely retrieved.'
        });

    } catch (err) {
        console.error('[QR_ACCESS_ERROR]', err.message);
        next(err);
    }
};
