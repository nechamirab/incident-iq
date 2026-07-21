import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';

export const healthRouter: Router = Router();

healthRouter.get('/', getHealth);
