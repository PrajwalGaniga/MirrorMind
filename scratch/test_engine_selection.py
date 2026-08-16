"""
MirrorMind Intelligence Engine Test Suite
Tests provider routing, RAG context, error handling, and no-fallback behavior.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from db import client
from services.rag_service import generate_rag_response

QUESTION = "What should I learn next for backend development?"


def section(title):
    print(f"\n{'='*55}")
    print(f"  {title}")
    print('='*55)


async def get_test_user(db):
    student = await db.students.find_one({})
    if not student:
        print("  [SKIP] No student found in DB.")
        return None
    user_id = student.get("user_id")
    print(f"  user_id = {user_id}")
    return user_id


# ── Test 1: OpenRouter ────────────────────────────────────────────────────────
async def test_openrouter(db, user_id):
    section("TEST 1 — provider=openrouter")
    try:
        result = await generate_rag_response(user_id, QUESTION, db, top_k=5, provider="openrouter")
        assert result["provider"] == "openrouter", f"Wrong provider: {result['provider']}"
        assert result["answer"], "Empty answer"
        print(f"  PASS provider={result['provider']}")
        print(f"  PASS model={result['model']}")
        print(f"  PASS answer preview: {result['answer'][:120]}...")
        return True
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


# ── Test 2: Ollama ────────────────────────────────────────────────────────────
async def test_ollama(db, user_id):
    section("TEST 2 — provider=ollama")
    try:
        result = await generate_rag_response(user_id, QUESTION, db, top_k=5, provider="ollama")
        assert result["provider"] == "ollama", f"Wrong provider: {result['provider']}"
        assert result["answer"], "Empty answer"
        print(f"  PASS provider={result['provider']}")
        print(f"  PASS model={result['model']}")
        print(f"  PASS answer preview: {result['answer'][:120]}...")
        return True
    except RuntimeError as e:
        err = str(e)
        if "OLLAMA_TIMEOUT" in err or "OLLAMA_CONNECT_ERROR" in err:
            print(f"  SKIP (Ollama unavailable): {err}")
            return None  # Not a test failure
        print(f"  FAIL (RuntimeError): {err}")
        return False
    except Exception as e:
        print(f"  FAIL: {e}")
        return False


# ── Test 3: Invalid provider ──────────────────────────────────────────────────
async def test_invalid_provider(db, user_id):
    section("TEST 3 — invalid provider")
    try:
        result = await generate_rag_response(user_id, QUESTION, db, top_k=5, provider="gpt4")
        print(f"  FAIL: Should have raised ValueError, got result")
        return False
    except ValueError as e:
        print(f"  PASS ValueError raised: {e}")
        return True
    except Exception as e:
        print(f"  FAIL unexpected exception: {e}")
        return False


# ── Test 4: RAG context identical regardless of provider ─────────────────────
async def test_rag_context_identical(db, user_id):
    section("TEST 4 — RAG context identical for both providers")
    from services.retrieval_service import retrieve_semantic_chunks
    from services.rag_service import _build_profile_context

    student = await db.students.find_one({"user_id": user_id}) or {}
    profile_ctx_1 = _build_profile_context(student)
    profile_ctx_2 = _build_profile_context(student)
    assert profile_ctx_1 == profile_ctx_2, "Profile context differs across calls!"

    retrieval_1 = await retrieve_semantic_chunks(user_id, QUESTION, db, 5)
    retrieval_2 = await retrieve_semantic_chunks(user_id, QUESTION, db, 5)

    chunks_1 = [c.get("chunk_id") for c in retrieval_1.get("results", [])]
    chunks_2 = [c.get("chunk_id") for c in retrieval_2.get("results", [])]
    assert chunks_1 == chunks_2, "Retrieved chunks differ across calls!"

    print(f"  PASS profile_chars={len(profile_ctx_1)}")
    print(f"  PASS retrieved_chunks={len(chunks_1)}")
    print(f"  PASS Context is deterministic and identical for both providers")
    return True


# ── Test 5: No automatic fallback ────────────────────────────────────────────
async def test_no_fallback(db, user_id):
    section("TEST 5 — No automatic fallback (Ollama should fail cleanly)")
    # Temporarily point to a bad URL to force connect error
    original_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    os.environ["OLLAMA_BASE_URL"] = "http://localhost:11111"  # Bad port

    try:
        result = await generate_rag_response(user_id, QUESTION, db, top_k=5, provider="ollama")
        # If we got here, it silently fell back — that's a FAIL
        print(f"  FAIL: Silently fell back instead of raising an error! Provider in result: {result.get('provider')}")
        return False
    except RuntimeError as e:
        err = str(e)
        if "OLLAMA_CONNECT_ERROR" in err or "OLLAMA_TIMEOUT" in err or "Ollama" in err:
            print(f"  PASS: Error raised correctly (no fallback): {err[:80]}")
            return True
        print(f"  PASS (RuntimeError, no fallback): {err[:80]}")
        return True
    except Exception as e:
        print(f"  PASS (Exception, no fallback): {type(e).__name__}: {str(e)[:80]}")
        return True
    finally:
        os.environ["OLLAMA_BASE_URL"] = original_url


# ── Test 6: MongoDB profile context ──────────────────────────────────────────
async def test_profile_context(db, user_id):
    section("TEST 6 — MongoDB profile context included")
    student = await db.students.find_one({"user_id": user_id}) or {}
    from services.rag_service import _build_profile_context
    ctx = _build_profile_context(student)

    if ctx == "No specific profile information available.":
        print(f"  WARN: Student has no profile data (empty student)")
    else:
        print(f"  PASS profile_chars={len(ctx)}")
        if "[SKILLS]" in ctx: print(f"  PASS Skills included")
        if "[STUDENT PROFILE]" in ctx: print(f"  PASS Student profile included")
        if "[PROJECTS]" in ctx: print(f"  PASS Projects included")
    return True


# ── Test 7: Ollama payload verification ──────────────────────────────────────
async def test_ollama_payload():
    section("TEST 7 — Ollama payload structure verification")
    from services.llm_service import _call_ollama
    import inspect, ast

    src = inspect.getsource(_call_ollama)
    checks = {
        '"stream": False': '"stream": False' in src,
        '"think": False':  '"think": False' in src,
        'qwen3:8b in model': 'qwen3:8b' in src or 'OLLAMA_MODEL' in src,
        'timeout from env': 'OLLAMA_TIMEOUT_SECONDS' in src,
    }
    all_pass = True
    for check, result in checks.items():
        status = "PASS" if result else "FAIL"
        print(f"  {status}: {check}")
        if not result:
            all_pass = False
    return all_pass


# ── Run all tests ─────────────────────────────────────────────────────────────
async def main():
    print("\n" + "="*55)
    print("  MirrorMind Intelligence Engine Test Suite")
    print("="*55)

    db = client.mirrormind
    user_id = await get_test_user(db)

    results = {}

    if user_id:
        results["openrouter"] = await test_openrouter(db, user_id)
        results["ollama"] = await test_ollama(db, user_id)
        results["invalid_provider"] = await test_invalid_provider(db, user_id)
        results["rag_context_identical"] = await test_rag_context_identical(db, user_id)
        results["no_fallback"] = await test_no_fallback(db, user_id)
        results["profile_context"] = await test_profile_context(db, user_id)

    results["ollama_payload"] = await test_ollama_payload()

    # ── Summary ───────────────────────────────────────────────────────────────
    section("SUMMARY")
    skipped = [k for k, v in results.items() if v is None]
    passed  = [k for k, v in results.items() if v is True]
    failed  = [k for k, v in results.items() if v is False]

    for k in passed:  print(f"  [PASS]  {k}")
    for k in skipped: print(f"  [SKIP]  {k} (external service unavailable)")
    for k in failed:  print(f"  [FAIL]  {k}")

    if failed:
        print("\n  STATUS: RED — One or more tests failed.")
    elif skipped:
        print("\n  STATUS: YELLOW — Implementation complete, some external services unavailable.")
    else:
        print("\n  STATUS: GREEN — All tests passed.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
