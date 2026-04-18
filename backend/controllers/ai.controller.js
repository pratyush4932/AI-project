import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Validate if the document is a medical report
const validateMedicalReport = (summaryData) => {
  // Check if response has medical-related fields with actual data
  const hasMedicalFields =
    (summaryData.chief_complaints && summaryData.chief_complaints.length > 0) ||
    (summaryData.active_medications && summaryData.active_medications.length > 0) ||
    (summaryData.allergies && summaryData.allergies.length > 0) ||
    (summaryData.abnormal_findings && summaryData.abnormal_findings.length > 0) ||
    (summaryData.test_results && summaryData.test_results.length > 0) ||
    (summaryData.vital_signs && summaryData.vital_signs.length > 0);

  // Check confidence score (medical reports should have reasonable confidence)
  const hasValidConfidence =
    summaryData.confidence_score && summaryData.confidence_score > 0.3;

  // Must have medical fields AND acceptable confidence, OR have medical fields
  // (some medical reports might have low confidence due to poor quality but still valid)
  return hasMedicalFields;
};

const SUMMARY_PROMPT = `You are a medical document analysis expert. Analyze the provided document and return a JSON response with the following structure:
{
  "task": "Medical Report Structuring and Summarization",
  "role": "You are Medora AI, a clinical-grade medical document structuring assistant integrated into a Zero-Trust healthcare system. Your job is to convert unstructured medical reports into structured, safe, and clinically useful summaries.",
  
  "input": {
    "type": "raw_medical_text",
    "source": "OCR or PDF extraction",
    "language": "Indian medical English (may include Hinglish terms, abbreviations, and handwritten-style text)"
  },

  "objective": [
    "Extract clinically relevant information from medical reports",
    "Convert unstructured text into structured JSON",
    "Highlight important patient health indicators",
    "Avoid hallucination or assumption of missing data",
    "Maintain safety and non-diagnostic boundaries"
  ],

  "instructions": [
    "Do NOT diagnose any disease",
    "Do NOT infer missing data",
    "If uncertain, return empty arrays []",
    "Prioritize accuracy over completeness",
    "Handle noisy OCR text carefully",
    "Recognize Indian prescriptions and lab formats",
    "Normalize medical abbreviations (e.g., BP, HbA1c, CBC)",
    "Ignore irrelevant text like headers, addresses, ads",
    "Extract only medically relevant entities"
  ],

  "extraction_targets": {
    "chief_complaints": "Symptoms reported by patient (e.g., fever, chest pain)",
    
    "active_medications": {
      "fields": ["name", "dosage", "frequency"],
      "example": {
        "name": "Metformin",
        "dosage": "500mg",
        "frequency": "1-0-1"
      }
    },

    "allergies": "Any drug, food, or environmental allergies",

    "abnormal_findings": "Lab values or observations outside normal range",

    "vital_signs": "Optional: BP, Sugar, Heart Rate if present",

    "test_results": "Key diagnostic test outputs (e.g., HbA1c, LDL, Creatinine)"
  },

  "output_format": {
    "type": "strict_json",
    "schema": {
      "chief_complaints": ["string"],
      "active_medications": [
        {
          "name": "string",
          "dosage": "string",
          "frequency": "string"
        }
      ],
      "allergies": ["string"],
      "abnormal_findings": ["string"],
      "vital_signs": ["string"],
      "test_results": ["string"],
      "confidence_score": "number (0-1)",
      "disclaimer": "string"
    }
  },

  "safety_layer": {
    "rules": [
      "Never provide medical advice",
      "Never suggest treatment changes",
      "Never assume patient condition",
      "Always include disclaimer"
    ],
    "mandatory_disclaimer": "This is an AI-generated summary for informational purposes only. Always verify with the original document and consult a qualified medical professional."
  },

  "quality_control": {
    "confidence_logic": "Lower confidence if OCR is noisy or incomplete",
    "fallback_behavior": "Return empty arrays if extraction fails",
    "validation": "Ensure valid JSON output only"
  },

  "context_awareness": {
    "region": "India",
    "common_patterns": [
      "1-0-1 dosage format",
      "Handwritten prescriptions",
      "Mixed English + local terminology",
      "Lab reports with reference ranges"
    ]
  },

  "example_input": "Patient reports fever and cough. Prescribed Paracetamol 500mg 1-1-1. HbA1c 8.5%. Allergy to penicillin.",

  "example_output": {
    "chief_complaints": ["Fever", "Cough"],
    "active_medications": [
      {
        "name": "Paracetamol",
        "dosage": "500mg",
        "frequency": "1-1-1"
      }
    ],
    "allergies": ["Penicillin"],
    "abnormal_findings": ["HbA1c 8.5% (High)"],
    "vital_signs": [],
    "test_results": ["HbA1c: 8.5%"],
    "confidence_score": 0.92,
    "disclaimer": "This is an AI-generated summary for informational purposes only. Always verify with the original document and consult a qualified medical professional."
  }
}`;

// Summarize document with Gemini AI
export const summarizeDocument = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please provide document or image files.',
      });
    }

    // Check file count limit
    if (req.files.length > 3) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 files can be uploaded at once.',
      });
    }

    const summaries = [];

    // Process each file
    for (const file of req.files) {
      const { originalname, path: filePath, mimetype, size } = file;

      // Validate file size (max 10MB per file)
      if (size > 10 * 1024 * 1024) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        summaries.push({
          fileName: originalname,
          success: false,
          error: 'File size exceeds 10MB limit.',
        });
        continue;
      }

      // Validate file type
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ];
      if (!allowedMimes.includes(mimetype)) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        summaries.push({
          fileName: originalname,
          success: false,
          error: 'Invalid file type. Only medical documents are allowed.',
          warning: 'Supported formats: PDF, DOCX, JPG, PNG. Please upload medical reports, prescriptions, lab tests, X-rays, or clinical notes.',
        });
        continue;
      }

      try {
        let fileContent;
        let prompt;

        // Handle different file types
        if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
          // For images and PDFs, read as base64 and send as inlineData
          const fileBuffer = fs.readFileSync(filePath);
          const base64Data = fileBuffer.toString('base64');
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const filePart = {
            inlineData: {
              data: base64Data,
              mimeType: mimetype,
            },
          };
          prompt = [SUMMARY_PROMPT, filePart];
          const result = await model.generateContent(prompt);
          const response = await result.response;
          fileContent = response.text();
        } else {
          // For DOCX or proper text, read as text for now
          // (Note: For robust parsing, consider using a DOCX parser library)
          fileContent = fs.readFileSync(filePath, 'utf-8');
          if (fileContent.length === 0) {
            throw new Error('File is empty');
          }
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          prompt = `${SUMMARY_PROMPT}\n\nDocument:\n${fileContent}`;
          const result = await model.generateContent(prompt);
          const response = await result.response;
          fileContent = response.text();
        }

        // Parse JSON response from Gemini
        let summaryData;
        try {
          summaryData = JSON.parse(fileContent);
        } catch (parseError) {
          // If Gemini returns wrapped JSON, try to extract it
          const jsonMatch = fileContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            summaryData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Invalid JSON response from Gemini API');
          }
        }

        // Validate that the file is a medical report
        const isMedicalReport = validateMedicalReport(summaryData);
        if (!isMedicalReport) {
          summaries.push({
            success: false,
            fileName: originalname,
            error: 'File is not a medical report. Only medical documents, prescriptions, lab reports, or medical records are allowed.',
            warning: 'Please upload valid medical documents such as prescription sheets, lab reports, X-ray reports, medical prescriptions, or clinical notes.',
          });
          continue;
        }

        summaries.push({
          success: true,
          fileName: originalname,
          ...summaryData,
        });
      } catch (fileError) {
        console.error(`Error processing ${originalname}:`, fileError);
        summaries.push({
          success: false,
          fileName: originalname,
          error: fileError.message || 'Error processing file',
        });
      } finally {
        // Cleanup: Delete uploaded file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Return structured response
    return res.status(200).json({
      success: true,
      data: summaries,
      message: `Processed ${summaries.length} file(s).`,
    });
  } catch (error) {
    // Cleanup if file still exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('AI Summarization Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error summarizing document. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const AGGREGATE_SUMMARY_PROMPT = `{
  "task": "Longitudinal Medical Summary Aggregation and Pattern Analysis",
  
  "role": "You are Medora Clinical Intelligence Engine, a healthcare-grade AI system designed to analyze multiple medical summaries over time and generate a consolidated, structured, and safe patient health overview. You specialize in pattern detection, trend analysis, and clinical structuring without making diagnoses.",
  
  "input": {
    "type": "array_of_medical_summaries",
    "description": "Each summary contains structured data (complaints, medications, findings, test results) along with timestamps if available"
  },

  "objective": [
    "Aggregate multiple medical summaries into a single unified health profile",
    "Identify trends across time (improvement, deterioration, consistency)",
    "Detect recurring symptoms and chronic indicators",
    "Merge redundant or duplicate data safely",
    "Provide structured outputs for doctor-friendly consumption",
    "Ensure zero hallucination and strict factual consistency"
  ],

  "strict_rules": [
    "DO NOT diagnose any disease",
    "DO NOT assume missing values",
    "DO NOT fabricate trends without clear evidence",
    "If timestamps are missing, avoid temporal claims",
    "If unsure, return empty arrays [] or neutral statements",
    "Prefer conservative interpretation over aggressive inference"
  ],

  "processing_logic": {
    "step_1_deduplication": "Merge repeated entries (same medication, allergy, complaint) into unique values",
    
    "step_2_temporal_analysis": "If timestamps exist, compare values across time to detect increase, decrease, or stability",
    
    "step_3_pattern_detection": "Identify recurring complaints, repeated abnormal findings, and chronic indicators",
    
    "step_4_grouping": "Classify findings into categories: metabolic, cardiovascular, respiratory, other",
    
    "step_5_medication_merge": "Combine medications by name, track frequency of occurrence across reports",
    
    "step_6_confidence": "Reduce confidence if data is sparse, inconsistent, or missing timestamps"
  },

  "output_format": {
    "type": "strict_json",
    "schema": {
      "overall_health_picture": "string (detailed but non-diagnostic summary of patient condition)",

      "key_health_indicators": [
        "string (important metrics like HbA1c, BP, cholesterol, etc.)"
      ],

      "identified_patterns": [
        "string (e.g., recurring high sugar, repeated infections)"
      ],

      "grouped_findings": {
        "metabolic": ["string"],
        "cardiovascular": ["string"],
        "respiratory": ["string"],
        "other": ["string"]
      },

      "consolidated_medications": [
        {
          "name": "string",
          "dosage": "string",
          "frequency_pattern": "string (e.g., appears in 3/5 reports)"
        }
      ],

      "consolidated_allergies": [
        "string"
      ],

      "abnormal_findings_summary": [
        "string"
      ],

      "test_results_trends": [
        "string (e.g., HbA1c decreased from 8.5% to 7.2% over 3 months)"
      ],

      "recurring_complaints": [
        "string"
      ],

      "intelligent_insights": [
        "string (high-value insights like improvement/deterioration patterns)"
      ],

      "grouped_summary_short": [
        "string (short grouped insights like 'Diabetes-related reports show improving trend')"
      ],

      "metadata": {
        "total_reports_analyzed": "number",
        "date_range": "string (if timestamps available, else 'unknown')",
        "data_completeness": "string (high/medium/low)"
      },

      "confidence_score": "number (0 to 1)",

      "disclaimer": "string"
    }
  },

  "insight_generation_rules": [
    "Only generate insights if supported by at least 2 data points",
    "Use clear comparison language: increased, decreased, stable",
    "Avoid medical conclusions, focus on observable trends",
    "Highlight clinically relevant improvements or risks"
  ],

  "example_insights": [
    "Blood sugar levels show a decreasing trend across recent reports",
    "Cholesterol levels remain consistently high across multiple reports",
    "Recurring complaints of chest pain observed in 3 reports",
    "Medication Metformin appears consistently, indicating ongoing diabetes management"
  ],

  "confidence_logic": {
    "high": "Consistent data with timestamps and multiple reports",
    "medium": "Partial data with some inconsistencies",
    "low": "Sparse or single-report data"
  },

  "mandatory_disclaimer": "This is an AI-generated consolidated summary for informational purposes only. It is not a medical diagnosis. Always verify with original reports and consult a qualified healthcare professional."
}`;

// Aggregate and summarize multiple summaries with Gemini AI
export const summarizeSummaries = async (req, res) => {
  try {
    // Validate request
    if (!req.body.summaryData || !Array.isArray(req.body.summaryData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Please provide summaryData as an array.',
      });
    }

    const { summaryData } = req.body;

    // Validate array is not empty
    if (summaryData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Summary data array is empty. Please provide at least one summary.',
      });
    }

    // Limit to avoid token overflow
    if (summaryData.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 summaries can be aggregated at once.',
      });
    }

    // Prepare summary data for AI
    const summariesText = summaryData
      .map(
        (summary, index) =>
          `Report ${index + 1}:\n${JSON.stringify(summary, null, 2)}`
      )
      .join('\n---\n');

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `${AGGREGATE_SUMMARY_PROMPT}\n\nMedical Summaries to Analyze:\n${summariesText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response from Gemini
    let aggregatedData;
    try {
      aggregatedData = JSON.parse(text);
    } catch (parseError) {
      // If Gemini returns wrapped JSON, try to extract it
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aggregatedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from Gemini API');
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...aggregatedData,
        summary_count: summaryData.length,
      },
      message: `Successfully aggregated ${summaryData.length} medical summary(ies).`,
    });
  } catch (error) {
    console.error('Summary Aggregation Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error aggregating summaries. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
