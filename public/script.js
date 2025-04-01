window.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('fileElem');
  const fileLinkDiv = document.getElementById('file-link');
  let uploadCompleted = false;

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function highlight(zone) {
    zone.classList.add('highlight');
  }

  function unhighlight(zone) {
    zone.classList.remove('highlight');
  }

  dropZone.addEventListener('dragenter', () => { if (!uploadCompleted) highlight(dropZone); });
  dropZone.addEventListener('dragover', () => { if (!uploadCompleted) highlight(dropZone); });
  dropZone.addEventListener('dragleave', () => { if (!uploadCompleted) unhighlight(dropZone); });
  dropZone.addEventListener('drop', (e) => {
    if (uploadCompleted) return;
    unhighlight(dropZone);
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    if (!uploadCompleted) fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (uploadCompleted) return;
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  window.addEventListener('paste', (e) => {
    if (uploadCompleted) return;
    const items = e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          uploadFile(file);
          break;
        }
      } else if (item.kind === 'string') {
        item.getAsString(async (pastedText) => {
          if (pastedText) {
            const textBlob = new Blob([pastedText], { type: 'text/plain' });
            const file = new File([textBlob], 'pasted_text.txt', { type: 'text/plain' });
            uploadFile(file);
          }
        });
        break;
      }
    }
  });

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }
      
      const data = await response.json();
      uploadCompleted = true;
      
      const dropZone = document.getElementById('drop-zone');
      if (dropZone) {
        dropZone.remove();
      }
      
      fileLinkDiv.classList.remove('hidden');
      fileLinkDiv.style.color = 'green';
      fileLinkDiv.innerHTML = `
        File <strong>${data.originalName}</strong> uploaded successfully.<br>
        File link (valid for ${data.retentionMinutes} mins): <a id="fileLinkAnchor" href="${data.fileLink}" target="_blank">${data.fileLink}</a>
        <button id="copyButton" data-target="fileLinkAnchor">Copy Link</button>
      `;

      const copyButton = document.getElementById("copyButton");
      copyButton.addEventListener("click", () => {
        const targetId = copyButton.getAttribute("data-target");
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          const textToCopy = targetElement.textContent;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
              .then(() => {
                showCopySuccess(copyButton);
              })
              .catch(err => {
                console.error("Failed to copy using Clipboard API:", err);
                fallbackCopyToClipboard(textToCopy, copyButton);
              });
          } else {
            fallbackCopyToClipboard(textToCopy, copyButton);
          }
        }
      });
      
    } catch (error) {
      console.error('Error uploading file:', error);
      fileLinkDiv.classList.remove('hidden');
      fileLinkDiv.style.color = 'red';
      fileLinkDiv.innerText = error.message || 'Error uploading file';
    }
  }

  function showCopySuccess(button) {
    button.textContent = "Copied!";
    setTimeout(() => button.textContent = "Copy Link", 2000);
  }

  function fallbackCopyToClipboard(text, button) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        showCopySuccess(button);
      } else {
        console.error("Fallback: Copy command was unsuccessful");
        button.textContent = "Error!";
        setTimeout(() => button.textContent = "Copy Link", 2000);
      }
    } catch (err) {
      console.error("Fallback: Unable to copy", err);
      button.textContent = "Error!";
      setTimeout(() => button.textContent = "Copy Link", 2000);
    }

    document.body.removeChild(textarea);
  }
});

