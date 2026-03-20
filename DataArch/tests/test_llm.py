"""
tests/test_llm.py — Unit tests for LLM module (chunking, merging, doc type detection).
No API key needed — tests exercise logic that doesn't call the LLM.
"""

from pipeline.llm import (
    chunk_text,
    _merge_extraction_results,
    _detect_document_type,
    ExtractionResult,
    ExtractedEntity,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    MODEL,
    SYSTEM_PROMPTS,
    EXTRACTION_TOOL,
)


# ── chunk_text ──────────────────────────────────────────────────────────────

def test_short_text_returns_single_chunk():
    """Text shorter than CHUNK_SIZE should return a single chunk."""
    text = "This is a short document."
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_empty_text_returns_single_chunk():
    chunks = chunk_text("")
    assert len(chunks) == 1


def test_long_text_produces_multiple_chunks():
    """Text longer than CHUNK_SIZE should be split into overlapping chunks."""
    text = "Word " * 3000  # ~15000 chars
    chunks = chunk_text(text, chunk_size=5000, overlap=500)
    assert len(chunks) >= 3


def test_chunks_have_overlap():
    """Consecutive chunks should overlap by approximately CHUNK_OVERLAP chars."""
    text = "A" * 20000
    chunks = chunk_text(text, chunk_size=5000, overlap=500)
    assert len(chunks) >= 4

    # Check that chunks aren't too small (except possibly the last one)
    for chunk in chunks[:-1]:
        assert len(chunk) >= 4000  # Shouldn't be tiny


def test_chunks_cover_entire_text():
    """All content from the original text should appear in at least one chunk."""
    text = "The quick brown fox jumps over the lazy dog. " * 400
    chunks = chunk_text(text, chunk_size=2000, overlap=200)

    # Verify the first 100 and last 100 chars appear in chunks
    assert text[:100] in chunks[0]
    assert text[-50:].strip() in chunks[-1]


def test_chunk_breaks_at_natural_boundaries():
    """Chunks should prefer to break at paragraph/sentence boundaries."""
    # Create text with clear paragraph breaks
    para = "This is a paragraph with some text.\n\n"
    text = para * 300  # lots of paragraphs
    chunks = chunk_text(text, chunk_size=3000, overlap=200)

    # Most chunk boundaries should be at paragraph breaks or newlines
    for chunk in chunks:
        # Each chunk (except maybe last) should end near a boundary
        stripped = chunk.rstrip()
        if stripped:
            assert stripped[-1] in ".}\n" or len(stripped) == len(text)


def test_custom_chunk_size():
    text = "word " * 1000  # 5000 chars
    chunks = chunk_text(text, chunk_size=1000, overlap=100)
    assert len(chunks) >= 4


# ── _merge_extraction_results ────────────────────────────────────────────────

def test_merge_single_result():
    result = ExtractionResult(
        summary="Test doc",
        entities=[ExtractedEntity(entity_type="vendor", name="Acme")],
        data_fields={"date": "2024-01-01"},
    )
    merged = _merge_extraction_results([result])
    assert merged.summary == "Test doc"
    assert len(merged.entities) == 1
    assert merged.data_fields["date"] == "2024-01-01"


def test_merge_deduplicates_entities():
    """Entities with same name+type across chunks should be deduplicated."""
    r1 = ExtractionResult(
        summary="Part 1",
        entities=[
            ExtractedEntity(entity_type="vendor", name="Acme Corp", confidence=0.9),
            ExtractedEntity(entity_type="customer", name="Beta LLC", confidence=0.8),
        ],
        data_fields={"amount": "$100"},
    )
    r2 = ExtractionResult(
        summary="Part 2",
        entities=[
            ExtractedEntity(entity_type="vendor", name="Acme Corp", confidence=0.7),
            ExtractedEntity(entity_type="employee", name="John Smith", confidence=0.95),
        ],
        data_fields={"date": "2024-01-15"},
    )
    merged = _merge_extraction_results([r1, r2])

    # Should have 3 unique entities, not 4
    assert len(merged.entities) == 3
    entity_names = [e.name for e in merged.entities]
    assert "Acme Corp" in entity_names
    assert "Beta LLC" in entity_names
    assert "John Smith" in entity_names

    # Acme Corp should keep the higher confidence (0.9 from r1)
    acme = [e for e in merged.entities if e.name == "Acme Corp"][0]
    assert acme.confidence == 0.9


def test_merge_combines_data_fields():
    r1 = ExtractionResult(data_fields={"amount": "$100"})
    r2 = ExtractionResult(data_fields={"date": "2024-01-15"})
    merged = _merge_extraction_results([r1, r2])

    assert "amount" in merged.data_fields
    assert "date" in merged.data_fields


def test_merge_combines_summaries():
    r1 = ExtractionResult(summary="This is an invoice.")
    r2 = ExtractionResult(summary="It contains line items.")
    merged = _merge_extraction_results([r1, r2])

    assert "invoice" in merged.summary
    assert "line items" in merged.summary


def test_merge_attribute_merging():
    """When deduplicating entities, attributes from both chunks should be merged."""
    r1 = ExtractionResult(
        entities=[
            ExtractedEntity(
                entity_type="vendor",
                name="Acme",
                confidence=0.9,
                attributes={"vendor_id": "V001"},
            ),
        ],
    )
    r2 = ExtractionResult(
        entities=[
            ExtractedEntity(
                entity_type="vendor",
                name="Acme",
                confidence=0.8,
                attributes={"payment_terms": "Net 30"},
            ),
        ],
    )
    merged = _merge_extraction_results([r1, r2])

    acme = merged.entities[0]
    assert acme.attributes["vendor_id"] == "V001"
    assert acme.attributes["payment_terms"] == "Net 30"


# ── _detect_document_type ────────────────────────────────────────────────────

def test_detect_invoice():
    text = "INVOICE #12345\nBill To: Acme Corp\nSubtotal: $1,234.56\nTotal Due: $1,350.00"
    assert _detect_document_type(text) == "invoice"


def test_detect_contract():
    text = "MASTER SERVICE AGREEMENT\nThis agreement is entered into by the parties..."
    assert _detect_document_type(text) == "contract"


def test_detect_financial_statement():
    text = "PROFIT AND LOSS STATEMENT\nFiscal Year 2024\nTotal Revenue: $5,000,000"
    assert _detect_document_type(text) == "financial_statement"


def test_detect_hr_document():
    text = "Employee Roster\nDepartment: Engineering\nHeadcount: 45\nCompensation Band: L5"
    assert _detect_document_type(text) == "hr_document"


def test_detect_default():
    text = "Some general business document about things."
    assert _detect_document_type(text) == "default"


# ── Configuration ────────────────────────────────────────────────────────────

def test_model_constant_exists():
    assert MODEL is not None
    assert isinstance(MODEL, str)
    assert len(MODEL) > 0


def test_system_prompts_have_all_types():
    expected_types = ["default", "invoice", "contract", "financial_statement", "hr_document"]
    for t in expected_types:
        assert t in SYSTEM_PROMPTS, f"Missing system prompt for '{t}'"


def test_extraction_tool_schema():
    """The extraction tool should have proper schema structure."""
    assert EXTRACTION_TOOL["name"] == "extract_document_data"
    schema = EXTRACTION_TOOL["input_schema"]
    assert "summary" in schema["properties"]
    assert "entities" in schema["properties"]
    assert "data_fields" in schema["properties"]
    assert schema["required"] == ["summary", "entities", "data_fields"]


# ── Pydantic validation ─────────────────────────────────────────────────────

def test_extraction_result_validation():
    """ExtractionResult should accept valid data."""
    result = ExtractionResult(
        summary="Test",
        entities=[
            ExtractedEntity(entity_type="vendor", name="Acme", confidence=0.9),
        ],
        data_fields={"amount": "$100"},
    )
    assert result.summary == "Test"
    assert len(result.entities) == 1
    assert result.entities[0].confidence == 0.9


def test_extraction_result_defaults():
    """ExtractionResult should have sensible defaults."""
    result = ExtractionResult()
    assert result.summary == ""
    assert result.entities == []
    assert result.data_fields == {}


def test_extracted_entity_defaults():
    """ExtractedEntity should have sensible defaults."""
    entity = ExtractedEntity(entity_type="vendor", name="Acme")
    assert entity.confidence == 0.5
    assert entity.attributes == {}
