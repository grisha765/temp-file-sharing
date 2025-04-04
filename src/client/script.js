window.addEventListener('DOMContentLoaded', () => {
  const dropZone         = document.getElementById('drop-zone');
  const fileInput        = document.getElementById('fileElem');
  const progressContainer= document.getElementById('progress-container');
  const uploadProgress   = document.getElementById('uploadProgress');
  const cancelButton     = document.getElementById('cancelButton');
  
  const uploadCard       = document.getElementById('uploadCard');
  const fileLinkCard     = document.getElementById('fileLinkCard');
  const errorCard        = document.getElementById('errorCard');
  
  const fileLinkDiv      = document.getElementById('file-link');
  const errorMessageDiv  = document.getElementById('error-message');

  let uploadCompleted = false;
  let currentXhr      = null;
  let MAX_FILE_SIZE_MB= 10;
  let isUploading     = false;

  function fetchConfig() {
    fetch('config')
      .then(res => res.json())
      .then(data => {
        MAX_FILE_SIZE_MB = data.maxFileSizeMb;
      })
      .catch(() => {});
  }
  fetchConfig();

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

  dropZone.addEventListener('dragenter', () => {
    if (!isUploading && !uploadCompleted) highlight(dropZone);
  });
  dropZone.addEventListener('dragover', () => {
    if (!isUploading && !uploadCompleted) highlight(dropZone);
  });
  dropZone.addEventListener('dragleave', () => {
    if (!isUploading && !uploadCompleted) unhighlight(dropZone);
  });

  dropZone.addEventListener('drop', (e) => {
    if (!isUploading && !uploadCompleted) {
      unhighlight(dropZone);
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        uploadFile(files[0]);
      }
    }
  });

  dropZone.addEventListener('click', () => {
    if (!isUploading && !uploadCompleted) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (!isUploading && !uploadCompleted) {
      if (fileInput.files && fileInput.files.length > 0) {
        uploadFile(fileInput.files[0]);
      }
    }
  });

  window.addEventListener('paste', (e) => {
    if (!isUploading && !uploadCompleted) {
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
          item.getAsString((pastedText) => {
            if (pastedText) {
              const textBlob = new Blob([pastedText], { type: 'text/plain' });
              const file = new File([textBlob], 'pasted_text.txt', { type: 'text/plain' });
              uploadFile(file);
            }
          });
          break;
        }
      }
    }
  });

  function uploadFile(file) {
    isUploading = true;
    dropZone.classList.add('disabled'); 
    fileInput.disabled = true;

    errorCard.classList.add('hidden');
    errorMessageDiv.textContent = '';

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      showError(`File is too large. Max allowed size is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    progressContainer.classList.remove('hidden');
    uploadProgress.value = 0;
    uploadProgress.textContent = '0%';

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    currentXhr = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        uploadProgress.value = percentComplete;
        uploadProgress.textContent = `${Math.floor(percentComplete)}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          handleUploadSuccess(data);
        } catch {
          showError('Upload completed, but response invalid.');
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          showError(errorData.error || `Upload failed with status ${xhr.status}`);
        } catch {
          showError(`Upload failed with status ${xhr.status}`);
        }
      }
      currentXhr = null;
    };

    xhr.onerror = () => {
      showError('Network error occurred during upload.');
      currentXhr = null;
    };

    xhr.onabort = () => {
      showError('Upload canceled by user.', true);
      currentXhr = null;
    };

    xhr.open('POST', 'upload');
    xhr.send(formData);

    cancelButton.onclick = () => {
      if (currentXhr) {
        currentXhr.abort();
      }
    };
  }

  function handleUploadSuccess(data) {
    uploadCompleted = true;
    uploadCard.classList.add('hidden');
    progressContainer.classList.add('hidden');

    fileLinkCard.classList.remove('hidden');
    fileLinkDiv.innerHTML = `
      <h2>Upload Successful</h2>
      <p>File <strong>${data.originalName}</strong> uploaded successfully.</p>
      <p>File link (valid for ${data.retentionMinutes} mins):<br>
        <a id="fileLinkAnchor" href="${data.fileLink}" target="_blank">${data.fileLink}</a>
        <button id="copyButton" class="btn" data-target="fileLinkAnchor">Copy Link</button>
      </p>
    `;
    if (data.textViewLink) {
      fileLinkDiv.innerHTML += `
        <p>
          Quick View link:<br>
          <a id="textViewLinkAnchor" href="${data.textViewLink}" target="_blank">${data.textViewLink}</a>
          <button id="copyQuickViewButton" class="btn" data-target="textViewLinkAnchor">
            Copy Quick View Link
          </button>
        </p>
      `;
    }

    const copyButton = document.getElementById("copyButton");
    copyButton.addEventListener("click", () => {
      const targetId = copyButton.getAttribute("data-target");
      copyToClipboardById(targetId, copyButton);
    });

    const copyQuickViewButton = document.getElementById("copyQuickViewButton");
    if (copyQuickViewButton) {
      copyQuickViewButton.addEventListener("click", () => {
        const targetId = copyQuickViewButton.getAttribute("data-target");
        copyToClipboardById(targetId, copyQuickViewButton);
      });
    }
  }

  function showError(message) {
    progressContainer.classList.add('hidden');

    errorCard.classList.remove('hidden');
    errorMessageDiv.textContent = message;

    isUploading = false;
    dropZone.classList.remove('disabled');
    fileInput.disabled = false;
  }

  function copyToClipboardById(elementId, button) {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) return;
    const textToCopy = targetElement.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => showCopySuccess(button))
        .catch(() => fallbackCopyToClipboard(textToCopy, button));
    } else {
      fallbackCopyToClipboard(textToCopy, button);
    }
  }

  function showCopySuccess(button) {
    const originalText = button.textContent;
    button.textContent = "Copied!";
    setTimeout(() => (button.textContent = originalText), 2000);
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
        button.textContent = "Error!";
        setTimeout(() => (button.textContent = "Copy Link"), 2000);
      }
    } catch {
      button.textContent = "Error!";
      setTimeout(() => (button.textContent = "Copy Link"), 2000);
    }
    document.body.removeChild(textarea);
  }
});

