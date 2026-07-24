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
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('AI Predictor', style: AppTheme.heading2(context)),
              const SizedBox(height: 4),
              Text('Run the ML engine against your profile',
                  style: AppTheme.caption(context)),
              const SizedBox(height: 24),
              if (prov.isLoading)
                _loadingCard(context)
              else if (prov.error != null)
                _errorCard(context, prov.error!)
              else if (prov.result == null)
                _ctaCard(context, prov)
              else ...[
                _insightCard(context, prov.result!.topInsight),
                const SizedBox(height: 16),
                _radarCard(context, prov.result!.skillRadar),
                const SizedBox(height: 16),
                _predictionsCard(context, prov.result!.predictions),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () {
                    prov.clear();
                  },
                  child: const Text('Run Again'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _ctaCard(BuildContext context, PredictProvider prov) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppTheme.lavender,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          const Text('✨', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          Text('Predict Your Career Path',
              style: AppTheme.sectionTitle(context), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(
            'Our AI analyses your skills, projects, internships and CGPA to find your best-fit career roles.',
            style: AppTheme.body(context),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.borderBlack,
              foregroundColor: Colors.white,
            ),
            onPressed: () => prov.predict(),
            child: const Text('🚀 Run AI Prediction'),
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
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          const CircularProgressIndicator(strokeWidth: 3),
          const SizedBox(height: 20),
          Text('Analysing your profile...', style: AppTheme.body(context)),
        ],
      ),
    );
  }

  Widget _errorCard(BuildContext context, String error) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.softRed,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
      ),
      child: Text(error, style: AppTheme.body(context)),
    );
  }

  Widget _insightCard(BuildContext context, String insight) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.mint,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          const Text('💡', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(insight,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
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
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Skill Radar', style: AppTheme.cardTitle(context)),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: RadarChart(
              RadarChartData(
                radarShape: RadarShape.polygon,
                tickCount: 4,
                ticksTextStyle: const TextStyle(fontSize: 0, color: Colors.transparent),
                gridBorderData: const BorderSide(color: Color(0xFFD8D2CE), width: 2.5),
                radarBorderData: const BorderSide(color: AppTheme.borderBlack, width: 2.5),
                titleTextStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                dataSets: [
                  RadarDataSet(
                    fillColor: AppTheme.lavender.withValues(alpha: 0.4),
                    borderColor: AppTheme.borderBlack,
                    borderWidth: 2.5,
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
      'technical_depth': 'Tech',
      'breadth': 'Breadth',
      'project_exp': 'Projects',
      'industry_exp': 'Industry',
      'academic': 'Academic',
      'soft_skills': 'Soft',
    };
    return labels[key] ?? key;
  }

  Widget _predictionsCard(BuildContext context, List<PredictionModel> predictions) {
    final colors = [AppTheme.lavender, AppTheme.mint, AppTheme.peach, AppTheme.skyBlue, AppTheme.softRed];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Career Predictions', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        ...predictions.asMap().entries.map((e) {
          final i = e.key;
          final pred = e.value;
          final color = colors[i % colors.length];
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: i == 0 ? AppTheme.borderBlack : AppTheme.cardWhite,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.borderBlack, width: 2),
                    ),
                    child: Center(
                      child: Text('#${pred.rank}',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pred.label,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: i == 0 ? Colors.white : AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: pred.confidence,
                            backgroundColor: i == 0
                                ? Colors.white24
                                : Colors.black12,
                            valueColor: AlwaysStoppedAnimation(color),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '${(pred.confidence * 100).toStringAsFixed(1)}%',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: i == 0 ? Colors.white : AppTheme.textPrimary,
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
