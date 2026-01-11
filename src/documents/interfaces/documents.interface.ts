interface IDocument {
  templateId: string,                 // Ссылка на шаблон
  userId: string,                     // Пользователь
  values: Record<string, any>,        // Значения переменных, ключи - Template.variables
  file?: {                            
    path: string,                     // Путь к файлу
    size: number,                     // Размер файла в байтах
    mimeType: string                  // MIME-тип файла (.pdf, .docx и т.п.)
  },
  createdAt: Date,                    // Дата создания
  updatedAt: Date                     // Дата последнего обновления документа
}