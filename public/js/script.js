// REPLACE a/bug-tracker/public/js/script.js WITH THIS:

document.addEventListener('DOMContentLoaded', () => {

 // --- SCENARIO 1: BUG DETAIL PAGE ---
 const existingStepsList = document.getElementById('steps-list');
 if (existingStepsList) {
  initializeDetailPage(existingStepsList);
 }

 // --- SCENARIO 2: NEW BUG PAGE ---
 const newBugForm = document.getElementById('new-bug-form');
 if (newBugForm) {
  initializeNewBugPage(newBugForm);
 }

});

// ===================================================================
// LOGIC FOR THE BUG DETAIL PAGE (using API)
// ===================================================================
function initializeDetailPage(stepsList) {
 const bugId = stepsList.dataset.bugId;
 const addStepBtn = document.querySelector('.steps-section #add-step-btn');
 const newStepInput = document.querySelector('.steps-section #new-step-description');

 let sortable = new Sortable(stepsList, {
  animation: 150, handle: '.step-description', onEnd: handleReorder,
 });

 fetchAndRenderSteps();

 if (addStepBtn) {
  addStepBtn.addEventListener('click', handleAddStep);
 }

 stepsList.addEventListener('click', (e) => {
  if (e.target.matches('.delete-step-btn')) handleDeleteStep(e.target.closest('li'));
  if (e.target.matches('.edit-step-btn')) toggleEditMode(e.target.closest('li'));
  if (e.target.matches('.save-step-btn')) handleSaveStep(e.target.closest('li'));
  if (e.target.matches('.cancel-edit-btn')) fetchAndRenderSteps();
 });

 async function fetchAndRenderSteps() {
  try {
   const response = await fetch(`/api/bugs/${bugId}/steps`);
   if (!response.ok) throw new Error('Failed to fetch steps');
   const steps = await response.json();
   renderSteps(steps);
  } catch (error) {
   console.error(error);
   stepsList.innerHTML = '<li>Error loading steps.</li>';
  }
 }

 function renderSteps(steps) {
  stepsList.innerHTML = '';
  if (steps.length === 0) {
   stepsList.innerHTML = '<li class="no-steps">No steps to reproduce have been added yet.</li>';
   return;
  }
  steps.forEach(step => {
   const li = document.createElement('li');
   li.dataset.stepId = step.id;
   // ***FIXED***: Added btn, btn-sm, and btn-secondary/danger classes
   li.innerHTML = `
                <span class="step-description">${escapeHTML(step.description)}</span>
                <div class="step-actions">
                    <button class="btn btn-secondary btn-sm edit-step-btn">Edit</button>
                    <button class="btn btn-danger btn-sm delete-step-btn">Delete</button>
                </div>`;
   stepsList.appendChild(li);
  });
 }

 async function handleAddStep() {
  const description = newStepInput.value.trim();
  if (!description) return;
  try {
   const response = await fetch(`/api/bugs/${bugId}/steps`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description })
   });
   if (!response.ok) throw new Error('Failed to add step');
   newStepInput.value = '';
   fetchAndRenderSteps();
  } catch (error) { console.error(error); alert('Error adding step.'); }
 }

 async function handleDeleteStep(li) {
  const stepId = li.dataset.stepId;
  if (!confirm('Are you sure?')) return;
  try {
   await fetch(`/api/steps/${stepId}`, { method: 'DELETE' });
   li.remove();
  } catch (error) { console.error(error); alert('Error deleting step.'); }
 }

 function toggleEditMode(li) {
  const descriptionSpan = li.querySelector('.step-description');
  const currentDescription = descriptionSpan.textContent;
  // ***FIXED***: Added btn and btn-sm classes for consistency
  li.innerHTML = `
            <input type="text" class="edit-step-input" value="${escapeHTML(currentDescription)}">
            <div class="step-actions">
                <button class="btn btn-sm save-step-btn">Save</button>
                <button class="btn btn-secondary btn-sm cancel-edit-btn">Cancel</button>
            </div>`;
  li.querySelector('.edit-step-input').focus();
 }

 async function handleSaveStep(li) {
  const stepId = li.dataset.stepId;
  const input = li.querySelector('.edit-step-input');
  const newDescription = input.value.trim();
  if (!newDescription) return;
  try {
   await fetch(`/api/steps/${stepId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: newDescription })
   });
   fetchAndRenderSteps();
  } catch (error) { console.error(error); alert('Error saving step.'); }
 }

 async function handleReorder() {
  const orderedIds = Array.from(stepsList.querySelectorAll('li[data-step-id]')).map(li => li.dataset.stepId);
  if (orderedIds.length === 0) return;
  try {
   await fetch(`/api/bugs/${bugId}/steps/reorder`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds })
   });
  } catch (error) { console.error(error); alert('Error reordering steps.'); }
 }
}

// ===================================================================
// LOGIC FOR THE NEW BUG PAGE (local manipulation, no API)
// ===================================================================
function initializeNewBugPage(form) {
 const stepsList = document.getElementById('new-steps-list');
 const addStepBtn = document.getElementById('add-step-btn');
 const newStepInput = document.getElementById('new-step-description');
 const stepsDataInput = document.getElementById('steps-data-input');

 let sortable = new Sortable(stepsList, { animation: 150 });

 addStepBtn.addEventListener('click', () => {
  const description = newStepInput.value.trim();
  if (!description) return;
  const li = document.createElement('li');
  // ***FIXED***: Added btn, btn-sm, and btn-danger classes
  li.innerHTML = `
            <span class="step-description">${escapeHTML(description)}</span>
            <div class="step-actions">
                <button type="button" class="btn btn-danger btn-sm delete-step-btn">Delete</button>
            </div>`;
  stepsList.appendChild(li);
  newStepInput.value = '';
 });

 stepsList.addEventListener('click', (e) => {
  if (e.target.matches('.delete-step-btn')) {
   e.target.closest('li').remove();
  }
 });

 form.addEventListener('submit', (e) => {
  const allSteps = stepsList.querySelectorAll('.step-description');
  const stepsArray = Array.from(allSteps).map(span => span.textContent);
  stepsDataInput.value = JSON.stringify(stepsArray);
 });
}

// Helper function to prevent HTML injection
function escapeHTML(str) {
 const p = document.createElement('p');
 p.textContent = str;
 return p.innerHTML;
}