window.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('fileElem');
  const fileLinkDiv = document.getElementById('file-link');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => highlight(dropZone), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => unhighlight(dropZone), false);
  });

  function highlight(zone) {
    zone.classList.add('highlight');
  }

  function unhighlight(zone) {
    zone.classList.remove('highlight');
  }

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files && fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  window.addEventListener('paste', (e) => {
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
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      fileLinkDiv.classList.remove('hidden');
      fileLinkDiv.style.color = 'green';
      fileLinkDiv.innerHTML = `
        File <strong>${data.originalName}</strong> uploaded successfully.<br>
        File link (valid for 30 mins): 
        <a href="${data.fileLink}" target="_blank">${data.fileLink}</a>
      `;
    } catch (error) {
      console.error('Error uploading file:', error);
      fileLinkDiv.classList.remove('hidden');
      fileLinkDiv.style.color = 'red';
      fileLinkDiv.innerText = error.message || 'Error uploading file';
    }
  }
});

