/**
 * Search Autocomplete & Table Filtering Module
 * Listens to live input on search bars (e.g. Search name, email, phone)
 * Displays a live autocomplete dropdown of matching words, names, emails, and phone numbers.
 * Dynamically filters corresponding table rows in real-time.
 */

document.addEventListener("DOMContentLoaded", () => {
  const searchInputs = document.querySelectorAll(".search-autocomplete-input");

  searchInputs.forEach((input) => {
    const wrapper = input.closest(".search-autocomplete-wrapper");
    if (!wrapper) return;

    const dropdown = wrapper.querySelector(".search-autocomplete-dropdown");
    const clearBtn = wrapper.querySelector(".search-clear-btn");
    const targetTableId = input.dataset.targetTable;

    // Locate target table: explicitly by ID, or nearby inside a card/page
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

      // Find all target tables if multiple exist in container (e.g. database view)
      const tables = targetTableId 
        ? [document.getElementById(targetTableId)].filter(Boolean)
        : Array.from(document.querySelectorAll(".db-table, table"));

      const suggestionsMap = new Map(); // key -> { value, category }
      let totalMatchCount = 0;

      tables.forEach((tbl) => {
        const rows = tbl.querySelectorAll("tbody tr");
        const headers = Array.from(tbl.querySelectorAll("thead th")).map(th => th.textContent.trim().toLowerCase());

        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          const matches = !q || text.includes(q);
          row.style.display = matches ? "" : "none";
          if (matches) totalMatchCount++;

          if (q && q.length >= 1) {
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
      });

      // Update clear button visibility
      if (clearBtn) {
        clearBtn.style.display = q ? "inline-flex" : "none";
      }

      // Render dropdown suggestions
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
});
