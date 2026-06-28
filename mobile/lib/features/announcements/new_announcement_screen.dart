import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class NewAnnouncementScreen extends StatefulWidget {
  const NewAnnouncementScreen({super.key});
  @override
  State<NewAnnouncementScreen> createState() => _NewAnnouncementScreenState();
}

class _NewAnnouncementScreenState extends State<NewAnnouncementScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  String _type = 'info';
  List<dynamic> _roles = [];
  List<dynamic> _units = [];
  List<String> _targetRoleIds = [];
  List<String> _targetUnitIds = [];
  bool _saving = false;

  final _typeData = {
    'info': ('📋 Informativo', AppColors.info),
    'warning': ('⚠️ Atenção', AppColors.warning),
    'urgent': ('🚨 Urgente', AppColors.danger),
    'celebration': ('🎉 Celebração', AppColors.gold),
  };

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([api.getRoles(), api.getUnits()]);
      setState(() { _roles = results[0].data ?? []; _units = results[1].data ?? []; });
    } catch (_) {}
  }

  Future<void> _publish() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await api.createAnnouncement({
        'title': _titleCtrl.text.trim(),
        'content': _contentCtrl.text.trim(),
        'type': _type,
        'targetRoleIds': _targetRoleIds.isEmpty ? null : _targetRoleIds,
        'targetUnitIds': _targetUnitIds.isEmpty ? null : _targetUnitIds,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('📣 Aviso publicado com sucesso!'), backgroundColor: AppColors.success));
        context.pop();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao publicar aviso'), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Publicar Aviso'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _publish,
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Publicar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Tipo
            _label('Tipo de aviso'),
            const SizedBox(height: 10),
            ...(_typeData.entries.map((e) => RadioListTile<String>(
              dense: true,
              value: e.key,
              groupValue: _type,
              onChanged: (v) => setState(() => _type = v!),
              activeColor: e.value.$2,
              title: Text(e.value.$1, style: const TextStyle(fontSize: 14)),
              tileColor: _type == e.key ? e.value.$2.withOpacity(0.06) : null,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ))),
            const SizedBox(height: 16),

            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Título *', prefixIcon: Icon(Icons.title_rounded)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Título obrigatório' : null,
            ),
            const SizedBox(height: 14),

            TextFormField(
              controller: _contentCtrl,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Mensagem *', prefixIcon: Icon(Icons.message_rounded), alignLabelWithHint: true),
              validator: (v) => v == null || v.trim().isEmpty ? 'Mensagem obrigatória' : null,
            ),
            const SizedBox(height: 20),

            // Segmentação por função
            _label('Segmentar por função (opcional)'),
            const SizedBox(height: 4),
            const Text('Deixe em branco para enviar a todos', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
              constraints: const BoxConstraints(maxHeight: 140),
              child: ListView(
                shrinkWrap: true,
                children: _roles.map((r) => CheckboxListTile(
                  dense: true,
                  value: _targetRoleIds.contains(r['id'].toString()),
                  activeColor: AppColors.navy,
                  title: Text(r['name'], style: const TextStyle(fontSize: 13)),
                  onChanged: (v) => setState(() => v! ? _targetRoleIds.add(r['id'].toString()) : _targetRoleIds.remove(r['id'].toString())),
                )).toList(),
              ),
            ),
            const SizedBox(height: 14),

            // Segmentação por unidade
            _label('Segmentar por unidade (opcional)'),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
              constraints: const BoxConstraints(maxHeight: 140),
              child: ListView(
                shrinkWrap: true,
                children: _units.map((u) => CheckboxListTile(
                  dense: true,
                  value: _targetUnitIds.contains(u['id'].toString()),
                  activeColor: AppColors.navy,
                  title: Text(u['name'], style: const TextStyle(fontSize: 13)),
                  onChanged: (v) => setState(() => v! ? _targetUnitIds.add(u['id'].toString()) : _targetUnitIds.remove(u['id'].toString())),
                )).toList(),
              ),
            ),
            const SizedBox(height: 40),

            ElevatedButton.icon(
              icon: const Icon(Icons.campaign_rounded),
              label: const Text('Publicar Aviso'),
              onPressed: _saving ? null : _publish,
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary));
}
