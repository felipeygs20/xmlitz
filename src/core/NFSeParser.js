/**
 * Parser para arquivos XML de NFSe
 * Processa XML ISO-8859-1 com múltiplas NFSe
 */

import fs from 'fs-extra';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../utils/OptimizedLogger.js';

export class NFSeParser {
    constructor() {
        this.parserOptions = {
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseNodeValue: false, // Não converter valores automaticamente
            parseAttributeValue: false, // Não converter atributos automaticamente
            arrayMode: false,
            trimValues: true,
            parseTrueNumberOnly: false
        };
        
        this.parser = new XMLParser(this.parserOptions);
    }

    /**
     * Calcula SHA256 de uma string
     */
    sha256hex(data) {
        return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
    }

    /**
     * Lê arquivo XML preservando encoding ISO-8859-1
     */
    async readXMLFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const xml = buffer.toString('latin1'); // ISO-8859-1 = latin1
            const size = buffer.length;
            const checksum = this.sha256hex(xml);
            
            return {
                xml,
                size,
                checksum,
                encoding: 'ISO-8859-1'
            };
        } catch (error) {
            logger.error('Erro ao ler arquivo XML', { 
                filePath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Parse do XML para JSON
     */
    parseXML(xmlContent) {
        try {
            return this.parser.parse(xmlContent);
        } catch (error) {
            logger.error('Erro ao fazer parse do XML', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Extrai array de NFSe do JSON parseado
     */
    extractNFSeArray(jsonData) {
        let nfseArray = [];

        try {
            // Caminho principal: consultarNotaResponse.ListaNfse.ComplNfse
            const response = jsonData?.consultarNotaResponse;
            if (!response) {
                logger.warn('Estrutura XML não reconhecida - consultarNotaResponse não encontrado');
                return [];
            }

            const listaNfse = response.ListaNfse;
            if (!listaNfse) {
                logger.warn('ListaNfse não encontrada');
                return [];
            }

            // ComplNfse pode ser array ou objeto único
            let complNfseArray = [];
            if (Array.isArray(listaNfse.ComplNfse)) {
                complNfseArray = listaNfse.ComplNfse;
            } else if (listaNfse.ComplNfse) {
                complNfseArray = [listaNfse.ComplNfse];
            }

            // Extrair NFSe de cada ComplNfse
            for (const complNfse of complNfseArray) {
                if (complNfse.Nfse) {
                    if (Array.isArray(complNfse.Nfse)) {
                        nfseArray.push(...complNfse.Nfse);
                    } else {
                        nfseArray.push(complNfse.Nfse);
                    }
                }
            }

            logger.debug('NFSe extraídas', { count: nfseArray.length });
            return nfseArray;

        } catch (error) {
            logger.error('Erro ao extrair NFSe do JSON', { 
                error: error.message 
            });
            return [];
        }
    }

    /**
     * Extrai dados estruturados de uma NFSe
     */
    extractNFSeData(nfse) {
        try {
            const infNfse = nfse.InfNfse;
            if (!infNfse) {
                logger.warn('InfNfse não encontrada na NFSe');
                return null;
            }

            // Dados básicos
            const numero = infNfse.Numero?.toString();
            const codigoVerificacao = infNfse.CodigoVerificacao;
            const dataEmissao = this.parseDate(infNfse.DataEmissao);
            const competencia = this.parseDate(infNfse.Competencia);

            // Prestador
            const prestador = infNfse.PrestadorServico?.IdentificacaoPrestador;
            const prestadorCnpj = this.parseStringField(prestador?.Cnpj);
            const prestadorRazaoSocial = this.parseStringField(prestador?.RazaoSocial);
            const prestadorInscricaoMunicipal = this.parseStringField(prestador?.InscricaoMunicipal);

            // Tomador
            const tomador = infNfse.TomadorServico?.IdentificacaoTomador;
            const tomadorCnpj = this.parseStringField(tomador?.Cnpj);
            const tomadorRazaoSocial = this.parseStringField(tomador?.RazaoSocial);

            // Valores
            const valores = infNfse.ValoresNfse;
            const valorServicos = this.parseDecimal(valores?.ValorServicos);
            const valorLiquido = this.parseDecimal(valores?.ValorLiquidoNfse);
            const valorIss = this.parseDecimal(valores?.ValorIss);
            const aliquota = this.parseDecimal(valores?.Aliquota);
            const baseCalculo = this.parseDecimal(valores?.BaseCalculo);

            // Serviço
            const servico = infNfse.Servico;
            const itemListaServico = servico?.ItemListaServico;
            const codigoCnae = servico?.CodigoCnae;
            const discriminacao = servico?.Discriminacao;
            const codigoMunicipio = servico?.CodigoMunicipio;

            // JSON completo para armazenamento
            const jsonData = JSON.stringify(infNfse);
            const checksum = this.sha256hex(jsonData);

            return {
                // Identificação
                numero,
                codigoVerificacao,
                dataEmissao,
                competencia,
                
                // Prestador
                prestadorCnpj,
                prestadorRazaoSocial,
                prestadorInscricaoMunicipal,
                
                // Tomador
                tomadorCnpj,
                tomadorRazaoSocial,
                
                // Valores
                valorServicos,
                valorLiquido,
                valorIss,
                aliquota,
                baseCalculo,
                
                // Serviço
                itemListaServico,
                codigoCnae,
                discriminacao,
                codigoMunicipio,
                
                // Dados técnicos
                jsonData,
                checksum,
                sizeBytes: Buffer.byteLength(jsonData, 'utf8')
            };

        } catch (error) {
            logger.error('Erro ao extrair dados da NFSe', { 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Parse de data no formato brasileiro
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            // Formato esperado: "2025-07-04 17:28:27" ou "2025-07-04T17:28:27"
            const cleanDate = dateStr.replace('T', ' ');
            return new Date(cleanDate).toISOString();
        } catch (error) {
            logger.warn('Erro ao fazer parse da data', { dateStr });
            return null;
        }
    }

    /**
     * Parse de valor decimal
     */
    parseDecimal(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    /**
     * Converte valor para string (evita conversão numérica)
     */
    parseStringField(value) {
        if (!value || value === '') return null;
        return String(value).replace('.0', ''); // Remove .0 se existir
    }

    /**
     * Processa arquivo XML completo
     */
    async processXMLFile(filePath, source = 'sistema') {
        logger.system(`Processando arquivo XML: ${filePath}`);

        try {
            // 1. Ler arquivo
            const fileData = await this.readXMLFile(filePath);
            
            // 2. Parse XML
            const jsonData = this.parseXML(fileData.xml);
            
            // 3. Extrair NFSe
            const nfseArray = this.extractNFSeArray(jsonData);
            
            // 4. Processar cada NFSe
            const processedNFSe = [];
            for (const nfse of nfseArray) {
                const nfseData = this.extractNFSeData(nfse);
                if (nfseData) {
                    processedNFSe.push(nfseData);
                }
            }

            logger.success(`Arquivo processado com sucesso`, {
                file: filePath,
                totalNFSe: nfseArray.length,
                processedNFSe: processedNFSe.length
            });

            return {
                // Dados do lote
                batch: {
                    source,
                    filename: filePath.split(/[/\\]/).pop(),
                    filePath,
                    rawXml: fileData.xml,
                    checksum: fileData.checksum,
                    sizeBytes: fileData.size,
                    encoding: fileData.encoding,
                    totalNfse: nfseArray.length,
                    processedNfse: processedNFSe.length
                },
                // NFSe processadas
                nfseList: processedNFSe
            };

        } catch (error) {
            logger.error('Erro ao processar arquivo XML', {
                filePath,
                error: error.message
            });
            throw error;
        }
    }
}
