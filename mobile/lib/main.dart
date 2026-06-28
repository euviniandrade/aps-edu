import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/api/api_client.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('Background FCM message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Hive.initFlutter();
  await Hive.openBox('auth');
  await Hive.openBox('settings');

  // Firebase init (only if google-services.json / GoogleService-Info.plist present)
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await _setupFCM();
  } catch (e) {
    debugPrint('Firebase not configured yet: $e');
  }

  runApp(const ProviderScope(child: ApsEduApp()));
}

Future<void> _setupFCM() async {
  final messaging = FirebaseMessaging.instance;

  await messaging.requestPermission(
    alert: true,
    badge: true,
    sound: true,
  );

  // Get FCM token and send to backend when user is logged in
  final token = await messaging.getToken();
  if (token != null) {
    final box = Hive.box('auth');
    final accessToken = box.get('accessToken');
    if (accessToken != null) {
      try {
        await api.updateFcmToken(token);
      } catch (_) {}
    }
    box.put('fcmToken', token);
  }

  // Token refresh
  messaging.onTokenRefresh.listen((newToken) async {
    final box = Hive.box('auth');
    box.put('fcmToken', newToken);
    final accessToken = box.get('accessToken');
    if (accessToken != null) {
      try {
        await api.updateFcmToken(newToken);
      } catch (_) {}
    }
  });

  // Foreground messages
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    debugPrint('FCM foreground message: ${message.notification?.title}');
  });
}

class ApsEduApp extends ConsumerWidget {
  const ApsEduApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'APS EDU',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }
}
