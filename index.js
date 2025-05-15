import express from "express";
import axios from "axios";
import { createClient } from "redis"; // نستورد createClient من مكتبة redis
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;
const DEFAULT_EXPIRATION = 3600; // وقت الانتهاء بالثواني (ساعة واحدة)

// ننشئ عميل Redis باستخدام URL الاتصال من متغيرات البيئة
// تأكد من وجود متغير REDIS_URL في ملف .env الخاص بك
const redisClient = createClient();

// معالجة أخطاء اتصال Redis (مهم للمراقبة)
redisClient.on('error', err => console.log('Redis Client Error', err));

// دالة غير متزامنة للاتصال بـ Redis
async function connectRedis() {
  try {
    // نبدأ عملية الاتصال وننتظر حتى تكتمل
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (error) {
    // تسجيل الخطأ إذا فشل الاتصال
    console.error("Failed to connect to Redis:", error);
    // يمكنك اختيار إيقاف التطبيق هنا إذا كان اتصال Redis حرجاً
    // process.exit(1);
  }
}

// نستدعي دالة الاتصال عند بدء تشغيل التطبيق
connectRedis();

// مسار الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("أهلاً بك في تطبيق Express بسيط يعمل مع mjs!");
});

app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;

  try {
    const cachedPhotos = await redisClient.get('photos');

    if (cachedPhotos != null) {
      console.log(`Cache hit`);
      return res.json(JSON.parse(cachedPhotos));
    }

    console.log(`Cache miss`);
    const { data } = await axios.get(
      "https://jsonplaceholder.typicode.com/photos",
      {
        params: { albumId },
      }
    );

    await redisClient.set('photos', JSON.stringify(data), {
      EX: DEFAULT_EXPIRATION,
    });

    res.json(data);
  } catch (error) {
    console.error(`Error fetching photos for key ${cacheKey}:`, error.message || error);
    res.status(500).send("Error fetching photos");
  }
});


app.get("/photos/:id", async (req, res) => {
  const photoId = req.params.id;
  const cacheKey = `photo:${photoId}`; // مفتاح كاش خاص بالصورة

  if (!redisClient.isOpen) {
      console.error("Redis client is not connected.");
      return res.status(503).send("Service Unavailable: Redis not connected.");
  }

  try {
    // محاولة جلب الصورة من الكاش أولاً
    const cachedPhoto = await redisClient.get(cacheKey);
    if (cachedPhoto != null) {
      console.log(`Cache hit for key: ${cacheKey}`);
      return res.json(JSON.parse(cachedPhoto));
    }

    console.log(`Cache miss for key: ${cacheKey}. Fetching from API.`);
    // إذا لم تكن في الكاش، نجلبها من الواجهة البرمجية
    const { data } = await axios.get(
      `https://jsonplaceholder.typicode.com/photos/${photoId}`
    );

    // نخزن الصورة في الكاش
    await redisClient.set(cacheKey, JSON.stringify(data), {
      EX: DEFAULT_EXPIRATION,
    });

    res.json(data);
  } catch (error) {
    console.error(`Error fetching photo with ID ${photoId}:`, error.message || error);
    res.status(500).send("Error fetching photo");
  }
});


// بدء تشغيل خادم Express
// يمكن نقل هذا الجزء داخل connectRedis بعد الاتصال الناجح إذا كان اتصال Redis حرجاً
app.listen(port, () => {
  console.log(`الخادم يعمل على http://localhost:${port}`);
});
