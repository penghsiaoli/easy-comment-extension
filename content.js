(() => {
  let active = false;
  let layer;
  let modeIndicator;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TOGGLE_COMMENT_MODE") {
      toggleMode();
    }
  });

  function toggleMode() {
    if (active) {
      layer?.remove();
      modeIndicator?.remove();
      active = false;
    } else {
      localStorage.removeItem("page-comments");
      initCommentMode();
      active = true;
    }
  }

  function initCommentMode() {
    layer = document.createElement("div");
    layer.id = "comment-layer";
    document.body.appendChild(layer);

    modeIndicator = document.createElement('div');
    modeIndicator.id = 'mode-indicator';
    modeIndicator.innerHTML = `
      <span>コメントモード</span>
      <button class="close-indicator-btn">非表示</button>
    `;
    document.body.appendChild(modeIndicator);

    modeIndicator.querySelector('.close-indicator-btn').addEventListener('click', () => {
      modeIndicator.remove();
    });

    // Set layer to cover the entire document
    layer.style.width = document.documentElement.scrollWidth + 'px';
    layer.style.height = document.documentElement.scrollHeight + 'px';

    // Load saved data
    const saved = JSON.parse(localStorage.getItem("page-comments") || "[]");
    saved.forEach(c => {
      if (c.highlight) {
        const hBox = document.createElement("div");
        hBox.id = c.highlight.id;
        hBox.className = "highlight-box";
        hBox.style.left = c.highlight.x + 'px';
        hBox.style.top = c.highlight.y + 'px';
        hBox.style.width = c.highlight.width + 'px';
        hBox.style.height = c.highlight.height + 'px';
        layer.appendChild(hBox);
      }
      addComment(c.x, c.y, c.text, c.highlight?.id);
    });

    // Drawing logic
    let startX, startY, highlightBox;
    let isDrawing = false;

    layer.addEventListener("mousedown", (e) => {
      if (e.target.id !== "comment-layer") return;
      isDrawing = true;

      startX = e.pageX; // Use pageX for coordinates relative to the document
      startY = e.pageY; // Use pageY for coordinates relative to the document

      highlightBox = document.createElement("div");
      highlightBox.className = "highlight-box";
      highlightBox.style.left = `${startX}px`;
      highlightBox.style.top = `${startY}px`;
      layer.appendChild(highlightBox);

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDrawing) return;
      const currentX = e.pageX;
      const currentY = e.pageY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      highlightBox.style.left = `${left}px`;
      highlightBox.style.top = `${top}px`;
      highlightBox.style.width = `${width}px`;
      highlightBox.style.height = `${height}px`;
    }

    function onMouseUp(e) {
      isDrawing = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      const boxWidth = parseInt(highlightBox.style.width) || 0;
      const boxHeight = parseInt(highlightBox.style.height) || 0;

      if (boxWidth < 10 && boxHeight < 10) {
        highlightBox.remove();
        return;
      }

      const highlightId = `highlight-${Date.now()}`;
      highlightBox.id = highlightId;

      const commentX = (parseInt(highlightBox.style.left) || 0) + boxWidth + 5;
      const commentY = parseInt(highlightBox.style.top) || 0;
      addComment(commentX, commentY, "", highlightId);

      saveComments();
    }
  }

  function addComment(x, y, text, highlightId) {
    const el = document.createElement("div");
    el.className = "comment-box";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (highlightId) {
      el.dataset.highlightId = highlightId;
    }

    // Stop click events from bubbling up to the layer
    el.addEventListener('mousedown', (e) => e.stopPropagation());

    el.innerHTML = `
      <div class="comment-header">
        <button class="delete">×</button>
      </div>
      <textarea placeholder="コメント..." rows="2">${text}</textarea>
    `;

    const delBtn = el.querySelector(".delete");
    delBtn.onclick = () => {
      const linkedHighlightId = el.dataset.highlightId;
      if (linkedHighlightId) {
        document.getElementById(linkedHighlightId)?.remove();
      }
      el.remove();
      saveComments();
    };

    el.querySelector("textarea").oninput = saveComments;
    layer.appendChild(el);

    // Drag logic for the comment box itself
    const header = el.querySelector(".comment-header");
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      // Use pageX/Y for correct offset calculation within a scrolling page
      offsetX = e.pageX - el.offsetLeft;
      offsetY = e.pageY - el.offsetTop;
      el.style.zIndex = 10000;
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      el.style.left = e.pageX - offsetX + "px";
      el.style.top = e.pageY - offsetY + "px";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        saveComments();
      }
    });
  }

  function saveComments() {
    const all = Array.from(document.querySelectorAll(".comment-box")).map(el => {
      const commentData = {
        x: parseInt(el.style.left),
        y: parseInt(el.style.top),
        text: el.querySelector("textarea").value,
        highlight: null
      };

      const linkedHighlightId = el.dataset.highlightId;
      if (linkedHighlightId) {
        const hBox = document.getElementById(linkedHighlightId);
        if (hBox) {
          commentData.highlight = {
            id: linkedHighlightId,
            x: parseInt(hBox.style.left),
            y: parseInt(hBox.style.top),
            width: parseInt(hBox.style.width),
            height: parseInt(hBox.style.height)
          };
        }
      }
      return commentData;
    });
    localStorage.setItem("page-comments", JSON.stringify(all));
  }
})();