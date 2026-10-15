import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/predict_provider.dart';
import '../../models/prediction_model.dart';

class PredictScreen extends StatelessWidget {
  const PredictScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prov = context.watch<PredictProvider>();

    return Scaffold(
      backgroundColor: AppTheme.canvas,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('AI Career Predictor', style: AppTheme.heading2(context)),
                      const SizedBox(height: 2),
                      Text(
                        'Softmax ML classifier trained on engineering roles',
                        style: AppTheme.caption(context),
                      ),
                    ],
                  ),
                  if (prov.result != null)
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded, color: AppTheme.primary),
                      onPressed: prov.isLoading ? null : () => prov.predict(),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              if (prov.isLoading)
                _loadingCard(context)
              else if (prov.error != null)
                _errorCard(context, prov.error!, prov)
              else if (prov.result == null)
                _ctaCard(context, prov)
              else ...[
                _heroTopRoleCard(context, prov.result!.predictions.first),
                const SizedBox(height: 16),
                _insightCard(context, prov.result!.topInsight),
                const SizedBox(height: 16),
                _radarCard(context, prov.result!.skillRadar),
                const SizedBox(height: 16),
                _predictionsCard(context, prov.result!.predictions),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () => prov.predict(),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Re-evaluate with Latest Profile'),
                ),
                const SizedBox(height: 80),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroTopRoleCard(BuildContext context, PredictionModel top) {
    final pct = (top.confidence * 100).toStringAsFixed(1);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3), width: 1.5),
        boxShadow: AppTheme.cardShadowHover,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1.0),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.workspace_premium_rounded, size: 14, color: AppTheme.primary),
                    SizedBox(width: 4),
                    Text(
                      'TOP PREDICTED ROLE',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.primary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.emeraldBg,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.2), width: 1.0),
                ),
                child: Text(
                  '$pct% Match',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.emeraldText),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            top.label,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'High alignment with your verified tech skills, projects, and interview responses.',
            style: TextStyle(fontSize: 13, color: AppTheme.textBody, height: 1.35),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: top.confidence,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation(AppTheme.primary),
              minHeight: 8,
            ),
          ),
        ],
      ),
    );
  }

  Widget _ctaCard(BuildContext context, PredictProvider prov) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              shape: BoxShape.circle,
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
            ),
            child: const Text('🚀', style: TextStyle(fontSize: 40)),
          ),
          const SizedBox(height: 20),
          const Text(
            'Predict Your Career Trajectory',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.3,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'Our ML engine analyzes your coursework, CGPA, GitHub projects, and certifications across 10 engineering specializations.',
            style: TextStyle(fontSize: 13, color: AppTheme.textCaption, height: 1.45),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            icon: const Icon(Icons.auto_awesome_rounded, size: 18),
            label: const Text('Run Career Prediction'),
            onPressed: () => prov.predict(),
          ),
        ],
      ),
    );
  }

  Widget _loadingCard(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: const Column(
        children: [
          SizedBox(
            width: 38,
            height: 38,
            child: CircularProgressIndicator(strokeWidth: 3, valueColor: AlwaysStoppedAnimation(AppTheme.primary)),
          ),
          SizedBox(height: 20),
          Text(
            'Evaluating Skill Embeddings…',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
          ),
          SizedBox(height: 6),
          Text(
            'Computing softmax probability distributions',
            style: TextStyle(fontSize: 12, color: AppTheme.textCaption),
          ),
        ],
      ),
    );
  }

  Widget _errorCard(BuildContext context, String error, PredictProvider prov) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.roseBg,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.error_outline_rounded, color: AppTheme.rose, size: 20),
              SizedBox(width: 8),
              Text('Prediction Error', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.roseText)),
            ],
          ),
          const SizedBox(height: 8),
          Text(error, style: const TextStyle(fontSize: 13, color: AppTheme.roseText)),
          const SizedBox(height: 12),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.rose,
              minimumSize: const Size(100, 38),
            ),
            onPressed: () => prov.predict(),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _insightCard(BuildContext context, String insight) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.emeraldBg,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.25), width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.lightbulb_outline_rounded, color: AppTheme.emerald, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              insight,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.emeraldText, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _radarCard(BuildContext context, Map<String, dynamic> radar) {
    final entries = radar.entries.toList();
    if (entries.isEmpty) return const SizedBox();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Skill Radar Breakdown', style: AppTheme.cardTitle(context)),
              const Text('6 Dimensions', style: TextStyle(fontSize: 11, color: AppTheme.textCaption)),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 210,
            child: RadarChart(
              RadarChartData(
                radarShape: RadarShape.polygon,
                tickCount: 4,
                ticksTextStyle: const TextStyle(fontSize: 0, color: Colors.transparent),
                gridBorderData: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                radarBorderData: const BorderSide(color: AppTheme.primary, width: 1.5),
                titleTextStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                dataSets: [
                  RadarDataSet(
                    fillColor: AppTheme.primary.withValues(alpha: 0.15),
                    borderColor: AppTheme.primary,
                    borderWidth: 2.0,
                    dataEntries: entries
                        .map((e) => RadarEntry(value: (e.value as num).toDouble()))
                        .toList(),
                  ),
                ],
                getTitle: (index, angle) =>
                    RadarChartTitle(text: _radarLabel(entries[index].key)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _radarLabel(String key) {
    const labels = {
      'technical_depth': 'Tech Depth',
      'breadth': 'Breadth',
      'project_exp': 'Projects',
      'industry_exp': 'Industry',
      'academic': 'Academic',
      'soft_skills': 'Soft Skills',
    };
    return labels[key] ?? key;
  }

  Widget _predictionsCard(BuildContext context, List<PredictionModel> predictions) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Role Probability Distribution', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        ...predictions.asMap().entries.map((e) {
          final i = e.key;
          final pred = e.value;
          final pct = (pred.confidence * 100).toStringAsFixed(1);
          final isTop = i == 0;

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isTop ? AppTheme.primaryLight : AppTheme.cardWhite,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isTop ? AppTheme.primary.withValues(alpha: 0.3) : AppTheme.borderLight,
                  width: 1.0,
                ),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: isTop ? AppTheme.primary : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '#${pred.rank}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: isTop ? Colors.white : AppTheme.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pred.label,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: isTop ? AppTheme.primaryDark : AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: pred.confidence,
                            backgroundColor: isTop ? AppTheme.primary.withValues(alpha: 0.15) : const Color(0xFFE2E8F0),
                            valueColor: AlwaysStoppedAnimation(isTop ? AppTheme.primary : const Color(0xFF64748B)),
                            minHeight: 5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '$pct%',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: isTop ? AppTheme.primary : AppTheme.textBody,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
