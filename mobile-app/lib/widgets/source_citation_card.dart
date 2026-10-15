import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/intelligence_model.dart';

class SourceCitationCard extends StatefulWidget {
  final SourceCitation source;
  final int index;

  const SourceCitationCard({
    super.key,
    required this.source,
    required this.index,
  });

  @override
  State<SourceCitationCard> createState() => _SourceCitationCardState();
}

class _SourceCitationCardState extends State<SourceCitationCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: AppTheme.cardSubtle,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (widget.source.text != null && widget.source.text!.isNotEmpty) {
            setState(() => _expanded = !_expanded);
          }
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryLight,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                    ),
                    child: Text(
                      'Ref [${widget.index}]',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.primary),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.source.filename,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.emeraldBg,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.2), width: 1.0),
                    ),
                    child: Text(
                      'p. ${widget.source.pageStart}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.emeraldText),
                    ),
                  ),
                  if (widget.source.text != null && widget.source.text!.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Icon(
                      _expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                      size: 18,
                      color: AppTheme.textCaption,
                    ),
                  ],
                ],
              ),
              if (_expanded && widget.source.text != null && widget.source.text!.isNotEmpty) ...[
                const Divider(height: 16, color: AppTheme.borderLight),
                Text(
                  widget.source.text!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textBody,
                    height: 1.45,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
