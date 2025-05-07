import express from "express";
import axios from "axios";
import { createClient } from "redis"; // نستورد createClient من مكتبة redis
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = 3000;
const DEFAULT_EXPIRATION = 3600; // وقت الانتهاء بالثواني

// ننشئ عميل Redis باستخدام URL الاتصال من متغيرات البيئة
const redisClient = createClient({url: process.env.REDIS_URL});

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
  }
}

// نستدعي دالة الاتصال عند بدء تشغيل التطبيق
connectRedis();


// مسار الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("أهلاً بك في تطبيق Express بسيط يعمل مع mjs!");
});

// مسار جلب الصور مع التخزين المؤقت
app.get("/photos", async (req, res) => {
  const albumId = req.query.albumId;


  if (!redisClient.isOpen) {
      console.error("Redis client is not connected.");
      // يمكنك إرسال استجابة خطأ مناسبة للعميل
      return res.status(503).send("Service Unavailable: Redis not connected.");
  }

  try {
    // 1. محاولة جلب البيانات من الكاش أولاً
    const cachedPhotos = await redisClient.get("photos");
    if (cachedPhotos != null) {
      console.log("Cache hit for photos");
      // إذا كانت البيانات موجودة في الكاش، نرسلها مباشرة
      return res.json(JSON.parse(cachedPhotos));
    }

    const { data } = await axios.get(
      "https://jsonplaceholder.typicode.com/photos",
      {
        params: { albumId },
      }
    );

    await redisClient.set("photos", JSON.stringify(data), {
      EX: DEFAULT_EXPIRATION, 
    });


    res.json(data);
  } catch (error) {
    // معالجة أي أخطاء تحدث أثناء الجلب أو التخزين المؤقت
    console.error("Error fetching photos:", error);
    res.status(500).send("Error fetching photos");
  }
});

// مسار جلب صورة واحدة بالمعرف (يمكنك إضافة منطق الكاش هنا أيضاً إذا أردت)
app.get("/photos/:id", async (req, res) => {
  const photoId = req.params.id;
  try {
    const { data } = await axios.get(
      `https://jsonplaceholder.typicode.com/photos/${photoId}`
    );

    res.json(data);
  } catch (error) {
    console.error(`Error fetching photo with ID ${photoId}:`, error);
    res.status(500).send("Error fetching photo");
  }
});

// بدء تشغيل خادم Express
app.listen(port, () => {
  console.log(`الخادم يعمل على http://localhost:${port}`);
});
