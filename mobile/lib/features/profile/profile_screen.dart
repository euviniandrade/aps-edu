import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getMe();
      setState(() { _user = res.data; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  void _logout() async {
    await Hive.box('auth').clear();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary)));

    final user = _user ?? {};
    final points = user['points'] ?? 0;
    final level = user['level'] ?? {};
    final levelProgress = level['progress'] ?? 0;
    final tasksCompleted = user['tasksCompleted'] ?? 0;
    final tasksOnTime = user['tasksOnTime'] ?? 0;
    final badgesCount = user['badgesCount'] ?? 0;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            backgroundColor: AppColors.primary,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(gradient: LinearGradient(colors: [AppColors.primary, AppColors.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 40),
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.white.withOpacity(0.3),
                      child: Text((user['name'] ?? 'U')[0], style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 10),
                    Text(user['name'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                    Text('${user['role']?['name'] ?? ''} | ${user['unit']?['name'] ?? ''}', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                  ],
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(delegate: SliverChildListDelegate([
              // Pontos e nível
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.star_rounded, color: AppColors.gold, size: 20),
                        const SizedBox(width: 6),
                        Text('$points pontos', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                        const Spacer(),
                        Text(level['name'] ?? '', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 10),
                      LinearProgressIndicator(value: levelProgress / 100, minHeight: 8, backgroundColor: AppColors.border, valueColor: const AlwaysStoppedAnimation(AppColors.gold)),
                      const SizedBox(height: 4),
                      Text('${level['pointsToNext'] ?? 0} pts para o próximo nível', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Stats
              Row(children: [
                Expanded(child: _statBox('Tarefas\nConcluídas', tasksCompleted.toString(), Icons.check_circle_rounded, AppColors.success)),
                const SizedBox(width: 8),
                Expanded(child: _statBox('No\nPrazo', '$tasksOnTime', Icons.timer_rounded, AppColors.primary)),
                const SizedBox(width: 8),
                Expanded(child: _statBox('Selos\nConquistados', badgesCount.toString(), Icons.military_tech_rounded, AppColors.gold)),
              ]),
              const SizedBox(height: 20),

              // Menu
              _menuItem(Icons.military_tech_rounded, 'Meus Selos', () => context.push('/badges'), AppColors.gold),
              _menuItem(Icons.leaderboard_rounded, 'Ranking', () => context.push('/ranking'), AppColors.primary),
              _menuItem(Icons.notifications_rounded, 'Notificações', () => context.push('/notifications'), AppColors.warning),
              _menuItem(Icons.feedback_rounded, 'Enviar Feedback', () => context.push('/feedback'), AppColors.success),
              _menuItem(Icons.settings_rounded, 'Configurações', () {}, AppColors.textSecondary),
              const Divider(),
              _menuItem(Icons.logout_rounded, 'Sair', _logout, AppColors.danger, isDestructive: true),
              const SizedBox(height: 60),
            ])),
          ),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary), textAlign: TextAlign.center),
      ]),
    );
  }

  Widget _menuItem(IconData icon, String title, VoidCallback onTap, Color color, {bool isDestructive = false}) {
    return ListTile(
      leading: Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: color, size: 20)),
      title: Text(title, style: TextStyle(fontWeight: FontWeight.w500, color: isDestructive ? AppColors.danger : AppColors.textPrimary)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 18),
      onTap: onTap,
    );
  }
}
