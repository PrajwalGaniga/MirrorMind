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
        color: AppTheme.cardWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (widget.source.text != null && widget.source.text!.isNotEmpty) {
            setState(() => _expanded = !_expanded);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.lavender,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.borderBlack, width: 1),
                    ),
                    child: Text(
                      'Source ${widget.index}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
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
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppTheme.mint,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'p. ${widget.source.pageStart}',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (widget.source.text != null && widget.source.text!.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Icon(
                      _expanded ? Icons.expand_less : Icons.expand_more,
                      size: 16,
                      color: AppTheme.textCaption,
                    ),
                  ],
                ],
              ),
              if (_expanded && widget.source.text != null && widget.source.text!.isNotEmpty) ...[
                const Divider(height: 14, color: Color(0xFFE0E0E0)),
                Text(
                  widget.source.text!,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textBody,
                    height: 1.4,
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
