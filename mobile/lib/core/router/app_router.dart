import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../features/auth/login_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/tasks/tasks_screen.dart';
import '../../features/tasks/task_detail_screen.dart';
import '../../features/tasks/new_task_screen.dart';
import '../../features/events/events_screen.dart';
import '../../features/events/event_detail_screen.dart';
import '../../features/events/new_event_screen.dart';
import '../../features/announcements/announcements_screen.dart';
import '../../features/announcements/new_announcement_screen.dart';
import '../../features/calendar/calendar_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/gamification/ranking_screen.dart';
import '../../features/gamification/badges_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/feedback/feedback_screen.dart';
import '../../shared/widgets/main_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final box = Hive.box('auth');
      final token = box.get('accessToken');
      final isLoggedIn = token != null;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/tasks', builder: (_, __) => const TasksScreen()),
          GoRoute(path: '/tasks/new', builder: (_, __) => const NewTaskScreen()),
          GoRoute(path: '/tasks/:id', builder: (_, state) => TaskDetailScreen(taskId: state.pathParameters['id']!)),
          GoRoute(path: '/events', builder: (_, __) => const EventsScreen()),
          GoRoute(path: '/events/new', builder: (_, __) => const NewEventScreen()),
          GoRoute(path: '/events/:id', builder: (_, state) => EventDetailScreen(eventId: state.pathParameters['id']!)),
          GoRoute(path: '/announcements', builder: (_, __) => const AnnouncementsScreen()),
          GoRoute(path: '/announcements/new', builder: (_, __) => const NewAnnouncementScreen()),
          GoRoute(path: '/calendar', builder: (_, __) => const CalendarScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/ranking', builder: (_, __) => const RankingScreen()),
          GoRoute(path: '/badges', builder: (_, __) => const BadgesScreen()),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
          GoRoute(path: '/feedback', builder: (_, __) => const FeedbackScreen()),
        ],
      ),
    ],
  );
});
