import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/tasks')) return 1;
    if (location.startsWith('/events')) return 2;
    if (location.startsWith('/announcements')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex(context),
        onTap: (i) {
          switch (i) {
            case 0: context.go('/'); break;
            case 1: context.go('/tasks'); break;
            case 2: context.go('/events'); break;
            case 3: context.go('/announcements'); break;
            case 4: context.go('/profile'); break;
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Início'),
          BottomNavigationBarItem(icon: Icon(Icons.check_circle_rounded), label: 'Tarefas'),
          BottomNavigationBarItem(icon: Icon(Icons.event_rounded), label: 'Eventos'),
          BottomNavigationBarItem(icon: Icon(Icons.campaign_rounded), label: 'Mural'),
          BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Perfil'),
        ],
      ),
    );
  }
}
