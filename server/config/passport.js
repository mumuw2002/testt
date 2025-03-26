const passport = require('passport'); // เพิ่มการ import passport
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // ปรับเส้นทางให้ถูกต้อง

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      const googleEmail = profile.emails?.[0]?.value;
      const googleId = profile.id;
      const profileImage = profile.photos?.[0]?.value;

      // ตรวจสอบว่ามีผู้ใช้ที่มี googleId หรือ googleEmail นี้อยู่แล้วหรือไม่
      let user = await User.findOne({ $or: [{ googleId }, { googleEmail }] });

      if (user) {
        // อัปเดตข้อมูลผู้ใช้หากมีข้อมูลใหม่จาก Google
        user.lastActive = Date.now();
        user.isOnline = true;
        if (!user.googleId) user.googleId = googleId;
        if (!user.profileImage) user.profileImage = profileImage;

        await user.save();
        return done(null, user);
      } else {
        // สร้างผู้ใช้ใหม่หากไม่มีในระบบ
        const newUser = new User({
          googleId,
          googleEmail,
          profileImage,
          role: "user",
          lastActive: Date.now(),
          isOnline: true,
        });

        await newUser.save();
        return done(null, newUser);
      }
    } catch (err) {
      console.error("Error in Google Strategy:", err);
      return done(err, null);
    }
  }
));

// ตั้งค่า LocalStrategy สำหรับการเข้าสู่ระบบ
passport.use(new LocalStrategy({ usernameField: 'googleEmail' }, User.authenticate()));


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;