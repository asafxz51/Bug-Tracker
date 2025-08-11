
document.addEventListener('DOMContentLoaded', () => {
 const newBugForm = document.getElementById('new-bug-form');
 if (newBugForm) {
  initializeStepsEditor(newBugForm);
 }

 const editBugForm = document.getElementById('edit-bug-form');
 if (editBugForm) {
  initializeStepsEditor(editBugForm);
 }
});

/**
 * Initializes a fully interactive steps editor for a given form.
 * This function handles adding, local editing, local deleting, reordering,
 * and packaging the steps data for form submission.
 * @param {HTMLFormElement} form The form element containing the steps editor.
 */
function initializeStepsEditor(form) {
 const stepsList = form.querySelector('ol');
 const addStepBtn = form.querySelector('#add-step-btn');
 const newStepInput = form.querySelector('#new-step-description');
 const stepsDataInput = form.querySelector('#steps-data-input');

 new Sortable(stepsList, { animation: 150, handle: '.step-description' });

 addStepBtn.addEventListener('click', () => {
  const description = newStepInput.value.trim();
  if (!description) return;
  const li = createStepListItem(description);
  stepsList.appendChild(li);
  newStepInput.value = '';
 });

 newStepInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
   e.preventDefault(); 
   addStepBtn.click();
  }
 });

 stepsList.addEventListener('click', (e) => {
  const target = e.target;
  if (target.matches('.delete-step-btn')) {
   target.closest('li').remove();
  }
  if (target.matches('.edit-step-btn')) {
   toggleEditMode(target.closest('li'));
  }
  if (target.matches('.save-step-btn')) {
   handleSaveStep(target.closest('li'));
  }
  if (target.matches('.cancel-edit-btn')) {
   cancelEditMode(target.closest('li'));
  }
 });

 form.addEventListener('submit', () => {
  const allSteps = stepsList.querySelectorAll('.step-description');
  const stepsArray = Array.from(allSteps).map(span => span.textContent);
  stepsDataInput.value = JSON.stringify(stepsArray);
 });


 function createStepListItem(description) {
  const li = document.createElement('li');
  li.innerHTML = `
            <span class="step-description">${escapeHTML(description)}</span>
            <div class="step-actions">
                <button type="button" class="btn btn-secondary btn-sm edit-step-btn">Edit</button>
                <button type="button" class="btn btn-danger btn-sm delete-step-btn">Delete</button>
            </div>`;
  return li;
 }

 function toggleEditMode(li) {
  const descriptionSpan = li.querySelector('.step-description');
  const currentDescription = descriptionSpan.textContent;
  li.dataset.originalDescription = currentDescription; 
  li.innerHTML = `
            <input type="text" class="edit-step-input" value="${escapeHTML(currentDescription)}">
            <div class="step-actions">
                <button type="button" class="btn btn-sm save-step-btn">Save</button>
                <button type="button" class="btn btn-secondary btn-sm cancel-edit-btn">Cancel</button>
            </div>`;
  li.querySelector('.edit-step-input').focus();
 }

 function handleSaveStep(li) {
  const input = li.querySelector('.edit-step-input');
  const newDescription = input.value.trim();
  if (newDescription) {
   li.innerHTML = createStepListItem(newDescription).innerHTML;
  }
 }

 function cancelEditMode(li) {
  const originalDescription = li.dataset.originalDescription;
  li.innerHTML = createStepListItem(originalDescription).innerHTML;
 }
}

function escapeHTML(str) {
 const p = document.createElement('p');
 p.textContent = str;
 return p.innerHTML;
}