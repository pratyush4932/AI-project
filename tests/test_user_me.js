import axios from "axios";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const API_BASE_URL = "http://localhost:6363";
const MOCK_OTP = "000000";

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

async function runTest() {
  log("🚀 Starting Interactive /user/me Endpoint Test", "cyan");
  log(`🔗 API Base: ${API_BASE_URL}`, "cyan");

  let token = null;

  try {
    const phone = await question('\n📱 Enter your phone number (e.g., +919876543210): ');

    if (!phone) {
      log("❌ Phone number is required", "red");
      rl.close();
      return;
    }

    // 1. Authenticate (Signup/Signin)
    log(`\n1️⃣ Authenticating user: ${phone}...`, "yellow");
    try {
      await axios.post(`${API_BASE_URL}/auth/signup/send-otp`, {
        phone: phone,
        firstName: "Test",
        lastName: "User"
      });
      log("✅ OTP sent for signup", "green");
    } catch (err) {
      if (err.response && err.response.status === 409) {
        log("ℹ️ User exists, sending signin OTP", "cyan");
        await axios.post(`${API_BASE_URL}/auth/signin/send-otp`, { phone: phone });
        log("✅ OTP sent for signin", "green");
      } else {
        throw err;
      }
    }

    // 2. Verify OTP
    const otp = await question(`🔐 Enter OTP (default dev OTP: ${MOCK_OTP}): `) || MOCK_OTP;

    log("2️⃣ Verifying OTP...", "yellow");
    let verifyRes;
    try {
      verifyRes = await axios.post(`${API_BASE_URL}/auth/signin/verify-otp`, {
        phone: phone,
        otp: otp
      });
    } catch (err) {
      // Try signup verify if signin verify fails (though signin verify should work if user exists)
      verifyRes = await axios.post(`${API_BASE_URL}/auth/signup/verify-otp`, {
        phone: phone,
        firstName: "Test",
        lastName: "User",
        otp: otp
      });
    }

    token = verifyRes.data.token;
    log("✅ Authentication successful!", "green");

    // 3. Test /user/me
    log("\n3️⃣ Calling GET /user/me...", "yellow");
    const userMeRes = await axios.get(`${API_BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (userMeRes.status === 200) {
      log("✅ GET /user/me successful (200 OK)", "green");

      log("\n📦 COMPLETE DATA JSON:", "magenta");
      console.log(JSON.stringify(userMeRes.data, null, 2));

      log("\n🎉 TEST COMPLETED SUCCESSFULLY!", "green");
    } else {
      log(`❌ GET /user/me failed with status: ${userMeRes.status}`, "red");
    }

  } catch (error) {
    log(`\n❌ Test failed: ${error.response?.data?.error || error.message}`, "red");
    if (error.response?.data) {
      console.log("Error Details:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    rl.close();
  }
}

runTest();
