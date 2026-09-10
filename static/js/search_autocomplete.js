/**
 * Search Autocomplete & Table Filtering & Pagination Module
 * Listens to live input on search bars (e.g. Search name, email, phone)
 * Displays a live autocomplete dropdown of matching words, names, emails, and phone numbers.
 * Dynamically filters corresponding table rows and manages clean pagination.
 */

document.addEventListener("DOMContentLoaded", () => {
  const searchInputs = document.querySelectorAll(".search-autocomplete-input");
  const PAGE_SIZE = 30;

  // Initialize pagination for tables on page load
  const allTables = document.querySelectorAll(".db-table, table");
  allTables.forEach((tbl) => setupTablePagination(tbl));

  searchInputs.forEach((input) => {
    const wrapper = input.closest(".search-autocomplete-wrapper");
    if (!wrapper) return;

    const dropdown = wrapper.querySelector(".search-autocomplete-dropdown");
    const clearBtn = wrapper.querySelector(".search-clear-btn");
    const targetTableId = input.dataset.targetTable;

    let targetTable = null;
    if (targetTableId) {
      targetTable = document.getElementById(targetTableId);
    }
    if (!targetTable) {
      targetTable = wrapper.closest("main, section, div")?.querySelector(".db-table, table");
    }

    let selectedIndex = -1;

    function filterTableAndBuildSuggestions(query) {
      const q = query.trim().toLowerCase();
      const tables = targetTableId 
        ? [document.getElementById(targetTableId)].filter(Boolean)
        : Array.from(document.querySelectorAll(".db-table, table"));

      const suggestionsMap = new Map();

      tables.forEach((tbl) => {
        const rows = Array.from(tbl.querySelectorAll("tbody tr"));
        const headers = Array.from(tbl.querySelectorAll("thead th")).map(th => th.textContent.trim().toLowerCase());

        // Reset to page 1 on new search
        tbl.dataset.currentPage = "1";

        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          const matches = !q || text.includes(q);
          row.dataset.searchMatch = matches ? "true" : "false";

          if (matches && q && q.length >= 1) {
            const cells = Array.from(row.querySelectorAll("td"));
            cells.forEach((cell, idx) => {
              const val = cell.innerText.trim();
              if (!val || val === "-" || val.toLowerCase().includes("download") || val.length > 80) return;

              const headerName = headers[idx] || "Detail";
              const lines = val.split("\n").map(s => s.trim()).filter(Boolean);

              lines.forEach((line) => {
                if (line.toLowerCase().includes(q)) {
                  if (!suggestionsMap.has(line)) {
                    let category = "Match";
                    if (line.includes("@")) {
                      category = "Email";
                    } else if (/^\+?\d[\d\s-]{7,}\d$/.test(line) || /^\d{10}$/.test(line)) {
                      category = "Phone";
                    } else if (headerName.includes("name") || headerName.includes("candidate")) {
                      category = "Name";
                    } else if (headerName.includes("role")) {
                      category = "Role";
                    } else {
                      category = headerName.charAt(0).toUpperCase() + headerName.slice(1);
                    }

                    suggestionsMap.set(line, { value: line, category });
                  }
                }
              });
            });
          }
        });

        renderTablePagination(tbl);
      });

      if (clearBtn) {
        clearBtn.style.display = q ? "inline-flex" : "none";
      }

      const suggestions = Array.from(suggestionsMap.values()).slice(0, 10);
      renderDropdown(suggestions, q);
    }

    function renderDropdown(items, query) {
      if (!dropdown) return;
      dropdown.innerHTML = "";
      selectedIndex = -1;

      if (!query || items.length === 0) {
        dropdown.classList.remove("active");
        return;
      }

      items.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "search-suggestion-item";
        div.dataset.index = idx;

        const val = item.value;
        const lowerVal = val.toLowerCase();
        const startIdx = lowerVal.indexOf(query.toLowerCase());

        let highlightedHTML = escapeHTML(val);
        if (startIdx >= 0) {
          const before = escapeHTML(val.substring(0, startIdx));
          const matchText = escapeHTML(val.substring(startIdx, startIdx + query.length));
          const after = escapeHTML(val.substring(startIdx + query.length));
          highlightedHTML = `${before}<mark>${matchText}</mark>${after}`;
        }

        let icon = "🔍";
        if (item.category === "Email") icon = "✉️";
        else if (item.category === "Phone") icon = "📞";
        else if (item.category === "Name") icon = "👤";
        else if (item.category === "Role") icon = "💼";

        div.innerHTML = `
          <span class="suggestion-icon">${icon}</span>
          <span class="suggestion-text">${highlightedHTML}</span>
          <span class="suggestion-badge">${escapeHTML(item.category)}</span>
        `;

        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectSuggestion(item.value);
        });

        dropdown.appendChild(div);
      });

      dropdown.classList.add("active");
    }

    function escapeHTML(str) {
      return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    function selectSuggestion(value) {
      input.value = value;
      filterTableAndBuildSuggestions(value);
      if (dropdown) dropdown.classList.remove("active");
    }

    input.addEventListener("input", (e) => {
      filterTableAndBuildSuggestions(e.target.value);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim()) {
        filterTableAndBuildSuggestions(input.value);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (dropdown) dropdown.classList.remove("active");
      }, 200);
    });

    input.addEventListener("keydown", (e) => {
      if (!dropdown || !dropdown.classList.contains("active")) return;
      const items = dropdown.querySelectorAll(".search-suggestion-item");
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateActiveSuggestion(items);
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && items[selectedIndex]) {
          e.preventDefault();
          const text = items[selectedIndex].querySelector(".suggestion-text")?.textContent;
          if (text) selectSuggestion(text);
        }
      } else if (e.key === "Escape") {
        dropdown.classList.remove("active");
      }
    });

    function updateActiveSuggestion(items) {
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add("selected");
          item.scrollIntoView({ block: "nearest" });
        } else {
          item.classList.remove("selected");
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        filterTableAndBuildSuggestions("");
        input.focus();
      });
    }
  });

  function setupTablePagination(table) {
    table.dataset.currentPage = "1";
    const card = table.closest(".db-table-card, section");
    if (!card) return;

    const prevBtn = card.querySelector(".prev-page-btn");
    const nextBtn = card.querySelector(".next-page-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        let cur = parseInt(table.dataset.currentPage || "1", 10);
        if (cur > 1) {
          table.dataset.currentPage = String(cur - 1);
          renderTablePagination(table);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        let cur = parseInt(table.dataset.currentPage || "1", 10);
        table.dataset.currentPage = String(cur + 1);
        renderTablePagination(table);
      });
    }

    renderTablePagination(table);
  }

  function renderTablePagination(table) {
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const matchingRows = rows.filter(r => r.dataset.searchMatch !== "false");
    const totalMatches = matchingRows.length;
    const totalPages = Math.max(Math.ceil(totalMatches / PAGE_SIZE), 1);

    let currentPage = parseInt(table.dataset.currentPage || "1", 10);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    table.dataset.currentPage = String(currentPage);

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;

    // Show/hide rows based on pagination
    rows.forEach(r => r.style.display = "none");
    const visiblePageRows = matchingRows.slice(startIdx, endIdx);
    visiblePageRows.forEach(r => r.style.display = "");

    // Update pagination status text
    const card = table.closest(".db-table-card, section");
    if (card) {
      const textElem = card.querySelector(".pagination-text, #reportsPaginationText");
      if (textElem) {
        textElem.textContent = `Showing ${visiblePageRows.length} of ${totalMatches} candidates. Page ${currentPage} of ${totalPages}.`;
      }
      const prevBtn = card.querySelector(".prev-page-btn");
      const nextBtn = card.querySelector(".next-page-btn");
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }
  }
});
