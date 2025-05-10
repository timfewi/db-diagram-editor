import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'diagram-editor',
        pathMatch: 'full'
    },
    {
        path: 'diagram-editor',
        loadComponent: () => import('./features/diagram-editor/diagram-editor.component').then(m => m.DiagramEditorComponent)
    }
];
