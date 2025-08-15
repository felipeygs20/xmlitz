/**
 * Validador de Requisições
 * Responsável por validar parâmetros de entrada da API
 */

export class RequestValidator {
    constructor() {
        this.cnpjRegex = /^\d{11}$|^\d{14}$/; // 11 ou 14 dígitos
        this.dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
    }
    
    /**
     * Valida requisição de download
     */
    validateDownloadRequest(body) {
        const errors = [];
        
        if (!body) {
            return {
                isValid: false,
                errors: ['Corpo da requisição é obrigatório']
            };
        }
        
        // Validar CNPJ
        if (!body.cnpj) {
            errors.push('CNPJ é obrigatório');
        } else if (!this.isValidCNPJ(body.cnpj)) {
            errors.push('CNPJ deve conter 11 ou 14 dígitos numéricos');
        }
        
        // Validar senha
        if (!body.senha) {
            errors.push('Senha é obrigatória');
        } else if (typeof body.senha !== 'string' || body.senha.trim().length === 0) {
            errors.push('Senha deve ser uma string não vazia');
        }
        
        // Validar datas (opcionais)
        if (body.startDate && !this.isValidDate(body.startDate)) {
            errors.push('startDate deve estar no formato YYYY-MM-DD');
        }
        
        if (body.endDate && !this.isValidDate(body.endDate)) {
            errors.push('endDate deve estar no formato YYYY-MM-DD');
        }
        
        // Validar período se ambas as datas forem fornecidas
        if (body.startDate && body.endDate) {
            const startDate = new Date(body.startDate);
            const endDate = new Date(body.endDate);
            
            if (startDate > endDate) {
                errors.push('startDate deve ser anterior ou igual a endDate');
            }
        }
        
        // Validar parâmetros opcionais
        if (body.headless !== undefined && typeof body.headless !== 'boolean') {
            errors.push('headless deve ser um valor booleano');
        }
        
        if (body.maxRetries !== undefined) {
            const retries = parseInt(body.maxRetries);
            if (isNaN(retries) || retries < 1 || retries > 10) {
                errors.push('maxRetries deve ser um número entre 1 e 10');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Valida formato do CNPJ
     */
    isValidCNPJ(cnpj) {
        if (!cnpj) return false;
        
        // Remover caracteres não numéricos
        const cleanCNPJ = cnpj.toString().replace(/\D/g, '');
        
        // Verificar se tem 11 ou 14 dígitos
        return this.cnpjRegex.test(cleanCNPJ);
    }
    
    /**
     * Valida formato da data
     */
    isValidDate(dateString) {
        if (!dateString) return false;
        
        // Verificar formato
        if (!this.dateRegex.test(dateString)) return false;
        
        // Verificar se é uma data válida
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }
}
