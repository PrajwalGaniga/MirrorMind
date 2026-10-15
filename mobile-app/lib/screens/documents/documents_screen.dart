import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/api.dart';
import '../../providers/document_provider.dart';
import '../../models/document_model.dart';
import '../../widgets/neo_card.dart';
import '../../widgets/status_badge.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DocumentProvider>().fetchDocuments();
    });
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );

    if (result == null || result.files.single.path == null) return;
    if (!mounted) return;

    final file = File(result.files.single.path!);
    String selectedCategory = 'resume';

    final shouldUpload = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: AppTheme.cardWhite,
          title: Text('Upload Document', style: AppTheme.heading2(context)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Selected: ${result.files.single.name}',
                style: AppTheme.body(context),
              ),
              const SizedBox(height: 16),
              const Text('Document Category:', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: selectedCategory,
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                items: const [
                  DropdownMenuItem(value: 'resume', child: Text('📄 Resume / CV')),
                  DropdownMenuItem(value: 'transcript', child: Text('📊 Academic Transcript')),
                  DropdownMenuItem(value: 'certificate', child: Text('🏆 Certificate')),
                  DropdownMenuItem(value: 'project_report', child: Text('📁 Project Report')),
                  DropdownMenuItem(value: 'other', child: Text('📑 Other Document')),
                ],
                onChanged: (val) {
                  if (val != null) setDialogState(() => selectedCategory = val);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel', style: TextStyle(color: AppTheme.textCaption)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(110, 42),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Upload PDF'),
            ),
          ],
        ),
      ),
    );

    if (shouldUpload == true && mounted) {
      final success = await context.read<DocumentProvider>().uploadDocument(file, selectedCategory);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Document uploaded successfully!' : (context.read<DocumentProvider>().error ?? 'Upload failed.')),
            backgroundColor: success ? AppTheme.emerald : AppTheme.rose,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final docProv = context.watch<DocumentProvider>();

    return Scaffold(
      backgroundColor: AppTheme.canvas,
      appBar: AppBar(
        title: const Text('Knowledge Base'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => docProv.fetchDocuments(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: docProv.isUploading ? null : _pickAndUpload,
        backgroundColor: AppTheme.primary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
        ),
        elevation: 3,
        icon: docProv.isUploading
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.upload_file_rounded, color: Colors.white),
        label: Text(
          docProv.isUploading ? 'Uploading…' : 'Upload PDF',
          style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
        ),
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: () => docProv.fetchDocuments(),
        child: docProv.isLoading
            ? const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(AppTheme.primary)))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                children: [
                  _buildHeaderBanner(docProv.documents),
                  const SizedBox(height: 16),
                  if (docProv.error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: AppTheme.roseBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
                      ),
                      child: Text(docProv.error!, style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.roseText)),
                    ),
                  ],
                  if (docProv.documents.isEmpty)
                    _buildEmptyState()
                  else
                    ...docProv.documents.map((doc) => _buildDocumentCard(doc)),
                ],
              ),
      ),
    );
  }

  Widget _buildHeaderBanner(List<DocumentModel> docs) {
    final processedCount = docs.where((d) => d.isProcessed).length;
    final embeddedCount = docs.where((d) => d.isEmbedded).length;
    final totalChunks = docs.fold<int>(0, (sum, d) => sum + (d.chunkCount ?? 0));

    return NeoCard(
      backgroundColor: AppTheme.cardWhite,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                ),
                child: const Icon(Icons.folder_shared_rounded, size: 24, color: AppTheme.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Document Knowledge Base', style: AppTheme.cardTitle(context)),
                    const SizedBox(height: 2),
                    Text(
                      'Upload your resumes & certificates to power MirrorMind AI RAG search.',
                      style: AppTheme.caption(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _statPill('${docs.length}', 'Documents', AppTheme.primaryLight, AppTheme.primary),
              _statPill('$totalChunks', 'Text Chunks', AppTheme.emeraldBg, AppTheme.emeraldText),
              _statPill('$embeddedCount / $processedCount', 'Indexed FAISS', AppTheme.purpleBg, AppTheme.purpleText),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statPill(String value, String label, Color bg, Color textCol) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: textCol.withValues(alpha: 0.15), width: 1.0),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textCol)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: textCol)),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: NeoCard(
        backgroundColor: AppTheme.cardWhite,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppTheme.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.cloud_upload_outlined, size: 40, color: AppTheme.primary),
            ),
            const SizedBox(height: 14),
            Text('No Documents Uploaded Yet', style: AppTheme.cardTitle(context)),
            const SizedBox(height: 6),
            Text(
              'Upload your resume, degree transcript, or certificates in PDF format to build your AI portfolio knowledge base.',
              style: AppTheme.caption(context),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _pickAndUpload,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Upload Your First Document'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDocumentCard(DocumentModel doc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: NeoCard(
        backgroundColor: AppTheme.cardWhite,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                  ),
                  child: const Icon(Icons.picture_as_pdf_rounded, size: 22, color: AppTheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doc.filename,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Category: ${doc.category.toUpperCase()} • ${doc.formattedSize}${doc.pageCount != null ? ' • ${doc.pageCount} pages' : ''}',
                        style: AppTheme.caption(context),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: AppTheme.borderLight, width: 1.0),
                  ),
                  onSelected: (val) async {
                    if (val == 'delete') {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                          title: const Text('Delete Document?'),
                          content: Text('Are you sure you want to delete "${doc.filename}" and its vector embeddings?'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.rose),
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text('Delete'),
                            ),
                          ],
                        ),
                      );
                      if (confirm == true && mounted) {
                        context.read<DocumentProvider>().deleteDocument(doc.id);
                      }
                    } else if (val == 'download') {
                      final url = Uri.parse(ApiConstants.documentDownload(doc.id));
                      launchUrl(url, mode: LaunchMode.externalApplication);
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'download', child: Text('📥 Download PDF')),
                    const PopupMenuItem(value: 'delete', child: Text('🗑️ Delete', style: TextStyle(color: AppTheme.rose))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                StatusBadge.processing(doc.processingStatus),
                StatusBadge.embedding(doc.embeddingStatus),
                if (doc.chunkCount != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.canvas,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppTheme.borderLight, width: 1.0),
                    ),
                    child: Text(
                      '${doc.chunkCount} Chunks',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textCaption),
                    ),
                  ),
              ],
            ),
            if (!doc.isProcessed || !doc.isEmbedded) ...[
              const Divider(height: 20, color: AppTheme.borderLight),
              Row(
                children: [
                  if (!doc.isProcessed)
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.emerald,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          minimumSize: const Size(0, 38),
                        ),
                        onPressed: doc.isProcessing
                            ? null
                            : () => context.read<DocumentProvider>().processDocument(doc.id),
                        icon: const Icon(Icons.auto_fix_high_rounded, size: 16),
                        label: Text(doc.isProcessing ? 'Processing…' : 'Extract Text'),
                      ),
                    )
                  else if (!doc.isEmbedded)
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          minimumSize: const Size(0, 38),
                        ),
                        onPressed: doc.isEmbedding
                            ? null
                            : () => context.read<DocumentProvider>().embedDocument(doc.id),
                        icon: const Icon(Icons.bolt_rounded, size: 16),
                        label: Text(doc.isEmbedding ? 'Embedding…' : 'Index into FAISS'),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
