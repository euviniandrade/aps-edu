import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});
  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  String _category = 'suggestion';
  bool _anonymous = false;
  bool _loading = false;
  bool _sent = false;
  final _ctrl = TextEditingController();

  final _categories = {
    'suggestion': ('Sugestão', Icons.lightbulb_rounded, AppColors.warning),
    'problem': ('Problema', Icons.bug_report_rounded, AppColors.danger),
    'idea': ('Ideia', Icons.psychology_rounded, AppColors.navy),
    'praise': ('Elogio', Icons.favorite_rounded, AppColors.success),
  };

  Future<void> _send() async {
    if (_ctrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      await api.sendFeedback({'category': _category, 'content': _ctrl.text.trim(), 'isAnonymous': _anonymous});
      setState(() { _sent = true; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Scaffold(
        appBar: AppBar(title: const Text('Feedback')),
        body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 80),
          const SizedBox(height: 16),
          const Text('Feedback enviado!', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Obrigado pela sua contribuição.', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 32),
          ElevatedButton(onPressed: () { setState(() { _sent = false; _ctrl.clear(); }); }, child: const Text('Enviar outro feedback')),
        ])),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Feedback ao Departamento')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Tipo de feedback', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true, crossAxisCount: 2, crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 2.5,
            children: _categories.entries.map((e) {
              final selected = _category == e.key;
              final color = e.value.$3;
              return GestureDetector(
                onTap: () => setState(() => _category = e.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: selected ? color.withOpacity(0.15) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: selected ? color : AppColors.border, width: selected ? 2 : 1),
                  ),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(e.value.$2, color: selected ? color : AppColors.textSecondary, size: 18),
                    const SizedBox(width: 6),
                    Text(e.value.$1, style: TextStyle(fontWeight: selected ? FontWeight.bold : FontWeight.normal, color: selected ? color : AppColors.textSecondary, fontSize: 13)),
                  ]),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          const Text('Sua mensagem', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 8),
          TextField(controller: _ctrl, maxLines: 5, decoration: const InputDecoration(hintText: 'Escreva sua mensagem aqui...')),
          const SizedBox(height: 20),
          SwitchListTile(
            title: const Text('Enviar como anônimo', style: TextStyle(fontWeight: FontWeight.w500)),
            subtitle: const Text('Seu nome não será identificado', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            value: _anonymous,
            onChanged: (v) => setState(() => _anonymous = v),
            activeColor: AppColors.navy,
            contentPadding: EdgeInsets.zero,
          ),
          const SizedBox(height: 28),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(
            icon: const Icon(Icons.send_rounded),
            label: const Text('Enviar Feedback'),
            onPressed: _loading ? null : _send,
          )),
        ]),
      ),
    );
  }
}
