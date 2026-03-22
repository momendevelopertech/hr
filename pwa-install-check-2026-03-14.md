# فحص زر «تثبيت التطبيق» في الـ Navbar — هل هو PWA فعلاً؟

تاريخ الفحص: 2026-03-14  
النطاق: `apps/web` + سلوك النسخة المنشورة `https://hr-web-ten.vercel.app`

## الخلاصة السريعة

**اللي موجود حالياً هو تجهيزات PWA جزئية، لكن مش ضمان كامل إن التثبيت هيشتغل للمستخدمين.**

- فيه `manifest.json` فعلاً.
- وفيه إعداد `next-pwa` في `next.config.js`.
- وزر في الـ Navbar بيستنى `beforeinstallprompt` علشان يظهر/يشتغل.
- **لكن أثناء الفحص على النسخة المنشورة، لم نجد Service Worker registration نشط في الصفحة** (registrations = `[]`).

النتيجة العملية: زر «تثبيت التطبيق» ممكن يبقى موجود في الكود، لكن تجربة "نزل كـ PWA" قد لا تشتغل كما تتوقعي إذا الـ Service Worker مش متسجل فعلياً في runtime.

---

## الأدلة من الكود الحالي

1) **وجود إعداد PWA في Next config**
- المشروع يستخدم `next-pwa` مع `register: true` و `skipWaiting: true`.

2) **وجود Web App Manifest**
- `manifest.json` موجود وفيه `display: "standalone"` و `start_url` وأيقونات.

3) **زر التثبيت في الـ Navbar**
- الزر مبني على event `beforeinstallprompt`.
- لو event لم يصل، الزر لا يظهر/لا يشتغل.
- على iOS لا يوجد prompt قياسي، لذلك الكود يعرض hint فقط "Add to Home Screen".

---

## الأدلة من الفحص على البيئة المنشورة

من اختبار المتصفح (Playwright) على الرابط الفعلي:

- `link rel="manifest"` موجود ويشير إلى `/manifest.json`.
- `GET /manifest.json` رجع `200`.
- `GET /sw.js` رجع `200`.
- لكن `navigator.serviceWorker.getRegistrations()` رجع `[]` (لا توجد registrations نشطة وقت الفحص).

دي نقطة مهمة: وجود `/sw.js` على السيرفر **لا يكفي** لوحده. لازم المتصفح يسجل الـ Service Worker فعلياً عشان PWA behavior (offline caching/install readiness) يشتغل بصورة متسقة.

---

## الفرق بين «اللي موجود» و «PWA مكتمل»

### الموجود الآن
- Manifest موجود ✅
- Install button موجود ✅
- Service Worker file موجود على السيرفر ✅

### الـ PWA المكتمل المفروض يكون
- Service Worker **registered + active** فعلياً في المتصفح ✅
- عند تحقق شروط المنصة، `beforeinstallprompt` يظهر بشكل متوقع ✅
- Offline behavior/asset caching واضح ومختبر ✅
- App install UX متسق عبر Android/Desktop + تعليمات iOS ✅

---

## ليه ممكن المستخدم يحس إن "الزر مش بينزل PWA"؟

أشهر الأسباب العملية:

1. `beforeinstallprompt` لا يطلقه المتصفح إلا بشروط (HTTPS، manifest صالح، SW فعال، وسياسات متصفح).
2. iOS لا يدعم نفس prompt؛ لازم Add to Home Screen يدوياً.
3. لو SW غير متسجل فعلياً، غالباً التثبيت/سلوك الـ PWA يبقى غير مكتمل.
4. أحياناً المتصفح يمنع تكرار prompt بعد dismiss أو بناءً على engagement heuristics.

---

## المطلوب لضمان إنها PWA فعلاً (خطوات عملية)

1) **تأكيد التسجيل runtime**
- في Production، افحص:
  - `navigator.serviceWorker.getRegistrations()` لازم يرجع registration فعلي.
  - `navigator.serviceWorker.controller` غالباً يصبح موجود بعد reload.

2) **إضافة diagnostics بسيطة (مؤقتة)**
- Log واضح في client يثبت:
  - هل SW اتسجل؟
  - هل `beforeinstallprompt` وصل؟
- ده يسهل تتبع سبب اختفاء زر التثبيت.

3) **تحسين UX الزر**
- لو no prompt event:
  - اعرض رسالة "التثبيت غير متاح على هذا المتصفح حالياً" بدل اختفاء صامت.
- iOS: إبقاء الإرشاد الحالي جيد.

4) **اختبار Lighthouse PWA + يدوي**
- التأكد من installability audits + اختبار Android Chrome فعلي.

5) **مراجعة إعدادات next-pwa مع App Router**
- التأكد أن التسجيل التلقائي شغال في البناء الحالي كما هو متوقع، أو إضافة تسجيل client صريح إذا لزم.

---

## الحكم النهائي على سؤالك

**هل اللي معمول حالياً "PWA كامل"؟**
- الإجابة: **جزئياً فقط**.
- الكود فيه مكونات PWA الأساسية، لكن من الفحص العملي على النسخة المنشورة، في علامة أن التسجيل الفعلي للـ Service Worker غير ظاهر وقت الاختبار؛ وبالتالي لا نقدر نقول إنه Installable PWA مضمون 100% للمستخدم النهائي.

