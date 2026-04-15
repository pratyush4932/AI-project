import { supabase } from "../config/supabase.js";
import { sendOTPService, verifyOTPService } from "../services/twilio.service.js";
import { generateToken } from "../utils/jwt.js";
import { validatePhone } from "../utils/validators.js";

const getFullName = ({ firstName, lastName, name }) => {
  if (typeof name === "string" && name.trim()) return name.trim();
  if (
    typeof firstName === "string" &&
    typeof lastName === "string" &&
    firstName.trim() &&
    lastName.trim()
  ) {
    return `${firstName.trim()} ${lastName.trim()}`;
  }
  return null;
};

export const sendSignupOTP = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, name } = req.body;

    const fullName = getFullName({ firstName, lastName, name });
    if (!fullName) {
      return res.status(400).json({ error: "Name (first+last or name) is required" });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingUser) {
      return res.status(409).json({ error: "User already exists. Please sign in." });
    }

    await sendOTPService(phone);

    res.json({ message: "OTP sent" });
  } catch (err) {
    next(err);
  }
};

export const verifySignupOTP = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, otp, name } = req.body;

    const fullName = getFullName({ firstName, lastName, name });
    if (!fullName) {
      return res.status(400).json({ error: "Name (first+last or name) is required" });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    const check = await verifyOTPService(phone, otp);

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    let { data: user, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (user) {
      return res.status(409).json({ error: "User already exists. Please sign in." });
    }

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([
        { phone, role: "patient", name: fullName }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    const token = generateToken(newUser);

    res.json({ token, user: newUser });

  } catch (err) {
    next(err);
  }
};

export const sendSigninOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    const { data: user, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (!user) {
      return res.status(404).json({ error: "User not found. Please sign up." });
    }

    await sendOTPService(phone);

    res.json({ message: "OTP sent" });
  } catch (err) {
    next(err);
  }
};

export const verifySigninOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone format" });
    }

    const check = await verifyOTPService(phone, otp);

    if (check.status !== "approved") {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    const { data: user, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) throw selectError;

    if (!user) {
      return res.status(404).json({ error: "User not found. Please sign up." });
    }

    const token = generateToken(user);

    res.json({ token, user });

  } catch (err) {
    next(err);
  }
};