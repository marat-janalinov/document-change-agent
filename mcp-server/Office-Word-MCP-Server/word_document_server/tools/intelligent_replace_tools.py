"""
Intelligent replace tools for Word Document Server.
Provides intelligent text replacement with table column distribution and comment insertion.
"""
import os
import logging
from typing import Optional
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from word_document_server.utils.file_utils import check_file_writeable, ensure_docx_extension

logger = logging.getLogger(__name__)
from word_document_server.utils.intelligent_table_utils import (
    find_table_containing_text,
    analyze_table_structure,
    distribute_text_to_columns,
    insert_paragraph_after_table,
    intelligent_replace_in_table
)
from word_document_server.utils.document_utils import find_and_replace_text


async def intelligent_replace_text(
    filename: str,
    old_text: str,
    new_text: str,
    match_case: bool = True,
    add_comment: Optional[str] = None,
    table_index: Optional[int] = None
) -> str:
    """
    Intelligently replace text in document, with smart distribution for tables.
    
    If text is found in a table:
    - Analyzes table structure (column count, types)
    - Distributes new text across columns intelligently
    - Optionally adds comment after table
    
    If text is in paragraphs:
    - Performs standard text replacement
    
    Args:
        filename: Path to the Word document
        old_text: Text to search for
        new_text: New text to replace with
        match_case: Whether to match case (default: True)
        add_comment: Optional comment text to add after table (if change is in table)
        table_index: Optional specific table index to search in (if specified, only this table is searched)
    
    Returns:
        Result message with operation details
    """
    filename = ensure_docx_extension(filename)
    
    if not os.path.exists(filename):
        return f"Document {filename} does not exist"
    
    # Check if file is writeable
    is_writeable, error_message = check_file_writeable(filename)
    if not is_writeable:
        return f"Cannot modify document: {error_message}. Consider creating a copy first."
    
    try:
        doc = Document(filename)
        
        # First, try to find text in tables
        # If table_index is specified, only search in that specific table
        table_location = find_table_containing_text(doc, old_text, match_case, table_index=table_index)
        
        if table_location:
            # Text found in table - use intelligent replacement
            table_idx, row_idx, col_idx = table_location
            
            # Perform intelligent replacement
            success = intelligent_replace_in_table(
                doc, table_idx, row_idx, old_text, new_text, match_case
            )
            
            if not success:
                return f"Failed to replace text in table {table_idx}, row {row_idx}"
            
            # Save document first
            doc.save(filename)
            
            # Add comment after table if requested
            comment_added = False
            if add_comment:
                try:
                    # Reload document to get updated structure
                    doc = Document(filename)
                    
                    # Insert comment paragraph directly after table using XML manipulation
                    comment_added = insert_paragraph_after_table(doc, table_idx, add_comment)
                    
                    if comment_added:
                        doc.save(filename)
                except Exception as e:
                    # Log but don't fail the operation
                    logger.warning(f"Failed to add comment after table: {e}")
                    comment_added = False
            
            result_msg = (
                f"Intelligently replaced '{old_text}' with '{new_text}' in table {table_idx}, row {row_idx}. "
                f"Text distributed across {len(analyze_table_structure(doc, table_idx).get('columns_count', 2))} columns."
            )
            if comment_added and add_comment:
                result_msg += f" Comment added after table."
            
            return result_msg
        else:
            # Text not in table - use standard replacement
            count = find_and_replace_text(doc, old_text, new_text)
            
            if count > 0:
                doc.save(filename)
                return f"Replaced {count} occurrence(s) of '{old_text}' with '{new_text}' in paragraphs."
            else:
                return f"No occurrences of '{old_text}' found in document."
                
    except Exception as e:
        return f"Failed to intelligently replace text: {str(e)}"

