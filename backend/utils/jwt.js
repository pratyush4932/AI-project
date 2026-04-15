import jwt from "jsonwebtoken";

export const generateToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not set");
    }

    const payload = {
        id: user?.id,
        phone: user?.phone,
        role: user?.role,
    };

    // Include optional fields if provided
    if (user?.hospital_id) {
        payload.hospital_id = user.hospital_id;
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
};