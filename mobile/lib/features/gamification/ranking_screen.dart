import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});
  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _scopes = ['weekly', 'monthly', 'global'];
  final Map<String, List<dynamic>> _rankings = {};
  final Map<String, int?> _myPositions = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() { if (!_tabController.indexIsChanging) _loadScope(_scopes[_tabController.index]); });
    _loadScope('weekly');
  }

  Future<void> _loadScope(String scope) async {
    if (_rankings[scope] != null) return;
    setState(() => _loading = true);
    try {
      final res = await api.getRanking(scope: scope);
      setState(() {
        _rankings[scope] = res.data['ranking'] ?? [];
        _myPositions[scope] = res.data['myPosition'];
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ranking'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [Tab(text: 'Semanal'), Tab(text: 'Mensal'), Tab(text: 'Geral')],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _scopes.map((scope) {
          final ranking = _rankings[scope] ?? [];
          final myPos = _myPositions[scope];
          return _loading && ranking.isEmpty
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : Column(children: [
                  if (myPos != null) Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(children: [
                      const Icon(Icons.person_rounded, color: Colors.white),
                      const SizedBox(width: 8),
                      const Text('Minha posição:', style: TextStyle(color: Colors.white, fontSize: 14)),
                      const Spacer(),
                      Text('#$myPos', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                    ]),
                  ),
                  Expanded(child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: ranking.length,
                    itemBuilder: (_, i) {
                      final item = ranking[i];
                      final pos = item['position'] ?? i + 1;
                      final pts = item['points'] ?? 0;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: pos <= 3 ? AppColors.gold.withOpacity(0.08) : Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: pos <= 3 ? AppColors.gold.withOpacity(0.3) : AppColors.border),
                        ),
                        child: Row(children: [
                          SizedBox(width: 32, child: Text(
                            pos == 1 ? '🥇' : pos == 2 ? '🥈' : pos == 3 ? '🥉' : '#$pos',
                            style: TextStyle(fontSize: pos <= 3 ? 22 : 14, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                            textAlign: TextAlign.center,
                          )),
                          const SizedBox(width: 12),
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.primary.withOpacity(0.15),
                            child: Text((item['user']?['name'] ?? 'U')[0], style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(item['user']?['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            Text(item['user']?['unit']?['name'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                          ])),
                          Text('$pts pts', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
                        ]),
                      );
                    },
                  )),
                ]);
        }).toList(),
      ),
    );
  }
}
