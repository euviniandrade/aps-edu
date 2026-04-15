import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class BadgesScreen extends StatefulWidget {
  const BadgesScreen({super.key});
  @override
  State<BadgesScreen> createState() => _BadgesScreenState();
}

class _BadgesScreenState extends State<BadgesScreen> {
  List<dynamic> _badges = [];
  bool _loading = true;
  String? _categoryFilter;

  final _categories = {
    null: 'Todos',
    'commitment': 'Comprometimento',
    'punctuality': 'Pontualidade',
    'productivity': 'Produtividade',
    'excellence': 'Excelência',
    'teamwork': 'Equipe',
    'leadership': 'Liderança',
  };

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getBadges(category: _categoryFilter);
      setState(() { _badges = res.data ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Color _levelColor(String? level) {
    switch (level) {
      case 'gold': return AppColors.gold;
      case 'silver': return AppColors.silver;
      default: return AppColors.bronze;
    }
  }

  @override
  Widget build(BuildContext context) {
    final earned = _badges.where((b) => b['earned'] == true).length;
    return Scaffold(
      appBar: AppBar(title: Text('Selos ($earned/${_badges.length})')),
      body: Column(
        children: [
          // Filtros categorias
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: _categories.entries.map((e) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(e.value, style: const TextStyle(fontSize: 12)),
                  selected: _categoryFilter == e.key,
                  onSelected: (_) { setState(() => _categoryFilter = e.key); _load(); },
                  selectedColor: AppColors.primary.withOpacity(0.15),
                ),
              )).toList(),
            ),
          ),

          // Progresso geral
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                LinearProgressIndicator(
                  value: _badges.isEmpty ? 0 : earned / _badges.length,
                  minHeight: 8, backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.gold),
                ),
                const SizedBox(height: 4),
                Text('$earned de ${_badges.length} selos conquistados', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 0.8),
                    itemCount: _badges.length,
                    itemBuilder: (_, i) {
                      final badge = _badges[i];
                      final isEarned = badge['earned'] == true;
                      final color = _levelColor(badge['level']);
                      return GestureDetector(
                        onTap: () => showDialog(context: context, builder: (_) => AlertDialog(
                          title: Text(badge['name'] ?? ''),
                          content: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.military_tech_rounded, size: 56, color: isEarned ? color : AppColors.border),
                            const SizedBox(height: 12),
                            Text(badge['description'] ?? '', textAlign: TextAlign.center),
                            const SizedBox(height: 8),
                            Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: AppColors.background, borderRadius: BorderRadius.circular(8)),
                              child: Text('Como ganhar: ${badge['criteria'] ?? ''}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), textAlign: TextAlign.center)),
                            if (isEarned) ...[
                              const SizedBox(height: 8),
                              const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(Icons.check_circle, color: AppColors.success, size: 16),
                                SizedBox(width: 4),
                                Text('Conquistado!', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold)),
                              ])
                            ]
                          ]),
                          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Fechar'))],
                        )),
                        child: Container(
                          decoration: BoxDecoration(
                            color: isEarned ? color.withOpacity(0.1) : AppColors.background,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isEarned ? color.withOpacity(0.4) : AppColors.border, width: isEarned ? 2 : 1),
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(Icons.military_tech_rounded, size: 40, color: isEarned ? color : AppColors.border),
                            const SizedBox(height: 6),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(badge['name'] ?? '', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isEarned ? AppColors.textPrimary : AppColors.textSecondary), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                              child: Text(badge['level']?.toString().toUpperCase() ?? '', style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
                            ),
                          ]),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
