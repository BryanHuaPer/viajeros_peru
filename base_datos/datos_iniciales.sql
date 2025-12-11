-- -----------------------------------------------------
-- INSERTAR DATOS DE PRUEBA MEJORADOS
-- -----------------------------------------------------

-- Usuarios con configuraciones modernas (el TRIGGER creará automáticamente sus perfiles)
INSERT INTO usuarios (correo, contrasena, nombre, apellido, rol, estado, idioma_preferido, config_notificaciones) VALUES
('admin@viajerosperu.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'Sistema', 'administrador', 'activo', 'es', '{"email": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "sugerencias_semanales": false}, "app": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "recordatorios_estancia": true}, "frecuencia_sugerencias": "semanal"}'),
('ana.garcia@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ana', 'García', 'anfitrion', 'activo', 'es', '{"email": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": false, "nuevas_resenas": true, "sugerencias_semanales": true}, "app": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "recordatorios_estancia": true}, "frecuencia_sugerencias": "diaria"}'),
('carlos.lopez@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Carlos', 'López', 'viajero', 'activo', 'es', '{"email": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "sugerencias_semanales": true}, "app": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "recordatorios_estancia": false}, "frecuencia_sugerencias": "semanal"}'),
('maria.rodriguez@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'María', 'Rodríguez', 'anfitrion', 'activo', 'en', '{"email": {"mensajes_nuevos": false, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "sugerencias_semanales": false}, "app": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "recordatorios_estancia": true}, "frecuencia_sugerencias": "nunca"}'),
('juan.martinez@email.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Juan', 'Martínez', 'viajero', 'activo', 'es', '{"email": {"mensajes_nuevos": true, "solicitudes_reserva": false, "confirmaciones_reserva": true, "nuevas_resenas": false, "sugerencias_semanales": true}, "app": {"mensajes_nuevos": true, "solicitudes_reserva": true, "confirmaciones_reserva": true, "nuevas_resenas": true, "recordatorios_estancia": true}, "frecuencia_sugerencias": "semanal"}');

-- Actualizar perfiles automáticamente creados por el trigger
UPDATE perfiles SET 
  biografia = 'Soy agricultora orgánica con 10 años de experiencia. Me encanta compartir conocimientos sobre permacultura y sostenibilidad. Vivo en el corazón del Valle Sagrado.',
  habilidades = 'Agricultura orgánica, Permacultura, Enseñanza, Cocina tradicional',
  idiomas = 'Español, Quechua, Inglés básico',
  foto_perfil = '/proyectoWeb/viajeros_peru/public/uploads/perfiles/ana-garcia.jpg',
  telefono = '+51 987 654 321',
  pais = 'Perú',
  ciudad = 'Cusco',
  ubicacion = 'Kilómetro 45, Valle Sagrado, Cusco',
  intereses = 'Agricultura sostenible, Intercambio cultural, Enseñanza, Turismo vivencial',
  disponibilidad = 'Siempre disponible',
  estado_verificacion = 'verificado',
  fecha_nacimiento = '1985-08-15'
WHERE usuario_id = 2;

UPDATE perfiles SET 
  biografia = 'Viajero apasionado por conocer nuevas culturas y aprender de comunidades locales. Tengo experiencia en enseñanza y construcción. He visitado 15 países hasta ahora.',
  habilidades = 'Enseñanza de inglés, Construcción básica, Cocina, Fotografía',
  idiomas = 'Español, Inglés fluido, Portugués, Francés básico',
  foto_perfil = '/proyectoWeb/viajeros_peru/public/uploads/perfiles/carlos-lopez.jpg',
  telefono = '+51 987 123 456',
  pais = 'México',
  ciudad = 'Ciudad de México',
  ubicacion = 'Colonia Condesa, Ciudad de México',
  intereses = 'Viajes, Intercambio cultural, Fotografía, Senderismo',
  disponibilidad = 'Siempre disponible',
  estado_verificacion = 'verificado',
  fecha_nacimiento = '1992-03-22'
WHERE usuario_id = 3;

UPDATE perfiles SET 
  biografia = 'Artista local especializada en tejidos tradicionales. Dirijo un taller comunitario donde preservamos técnicas ancestrales. Amo compartir mi cultura con viajeros.',
  habilidades = 'Tejido tradicional, Enseñanza de arte, Gestión cultural, Turismo comunitario',
  idiomas = 'Español, Aymara',
  foto_perfil = '/proyectoWeb/viajeros_peru/public/uploads/perfiles/maria-rodriguez.jpg',
  telefono = '+51 987 789 123',
  pais = 'Perú',
  ciudad = 'Puno',
  ubicacion = 'Avenida El Sol 123, Puno Centro',
  intereses = 'Arte tradicional, Turismo cultural, Preservación cultural, Artesanía',
  disponibilidad = 'Siempre disponible',
  estado_verificacion = 'pendiente',
  fecha_nacimiento = '1978-11-30'
WHERE usuario_id = 4;

UPDATE perfiles SET 
  biografia = 'Ingeniero que decidió cambiar la ciudad por la naturaleza. Ahora vivo en Huaraz y me dedico al turismo de aventura. Busco viajeros que amen las montañas.',
  habilidades = 'Guía de trekking, Primeros auxilios, Fotografía, Inglés',
  idiomas = 'Español, Inglés, Alemán básico',
  foto_perfil = '/proyectoWeb/viajeros_peru/public/uploads/perfiles/juan-martinez.jpg',
  telefono = '+51 987 456 789',
  pais = 'Perú',
  ciudad = 'Huaraz',
  ubicacion = 'Calle Los Pinos 456, Huaraz',
  intereses = 'Montañismo, Fotografía, Naturaleza, Aventura',
  disponibilidad = 'Siempre disponible',
  estado_verificacion = 'no_verificado',
  fecha_nacimiento = '1988-06-10'
WHERE usuario_id = 5;

-- Anuncios con coordenadas para mapa
INSERT INTO anuncios (anfitrion_id, titulo, descripcion, ubicacion, latitud, longitud, tipo_actividad, duracion_minima, duracion_maxima, cupos_disponibles, requisitos, comodidades) VALUES
(2, 'Ayuda en granja orgánica en Cusco', 'Buscamos voluntarios para ayudar en nuestra granja orgánica. Aprenderás sobre agricultura sostenible y permacultura. Trabajamos con técnicas ancestrales y modernas en el corazón del Valle Sagrado.', 'Cusco, Perú', -13.531950, -71.967463, 'agricultura', 7, 30, 3, 'Ganas de aprender, trabajo en equipo, interés en sostenibilidad, respeto por la naturaleza', 'Habitación privada, comidas incluidas, WiFi, área común, baño compartido'),
(2, 'Enseñanza de inglés a niños en comunidad', 'Voluntarios para enseñar inglés básico a niños en comunidad rural. Experiencia muy enriquecedora con impacto directo en la comunidad. Los niños son muy entusiastas y agradecidos.', 'Sacred Valley, Cusco', -13.333333, -72.083333, 'ensenanza', 14, 90, 2, 'Nativo o avanzado en inglés, paciencia con niños, experiencia en enseñanza deseable, creatividad', 'Alojamiento familiar, 3 comidas al día, transporte local, acceso a internet'),
(4, 'Aprendizaje de tejidos tradicionales andinos', 'Únete a nuestro taller de tejidos tradicionales. Aprenderás técnicas ancestrales mientras ayudas en la comunidad. Perfecto para amantes del arte y la cultura.', 'Puno, Perú', -15.840222, -70.021881, 'artesania', 10, 60, 4, 'Interés en arte tradicional, paciencia para aprender, respeto por culturas locales, creatividad', 'Alojamiento compartido, materiales incluidos, comidas, taller equipado'),
(5, 'Guía asistente para trekking en Huaraz', 'Buscamos asistente para expediciones de trekking en la Cordillera Blanca. Ideal para amantes de la montaña que quieran experiencia en turismo de aventura.', 'Huaraz, Perú', -9.526443, -77.528442, 'turismo', 5, 21, 2, 'Buena condición física, experiencia en montaña, primeros auxilios básico, responsabilidad', 'Alojamiento en refugio, equipo de trekking, alimentación, entrenamiento');

-- Imágenes de anuncios
INSERT INTO anuncio_imagenes (anuncio_id, url_imagen, orden) VALUES
(1, '/public/uploads/anuncios/granja-cusco-1.jpg', 1),
(1, '/public/uploads/anuncios/granja-cusco-2.jpg', 2),
(1, '/public/uploads/anuncios/granja-cusco-3.jpg', 3),
(2, '/public/uploads/anuncios/ensenanza-ingles-1.jpg', 1),
(2, '/public/uploads/anuncios/ensenanza-ingles-2.jpg', 2),
(3, '/public/uploads/anuncios/tejidos-andinos-1.jpg', 1),
(3, '/public/uploads/anuncios/tejidos-andinos-2.jpg', 2),
(4, '/public/uploads/anuncios/trekking-huaraz-1.jpg', 1),
(4, '/public/uploads/anuncios/trekking-huaraz-2.jpg', 2);

-- Reservas con fecha_respuesta
INSERT INTO reservas (anuncio_id, viajero_id, fecha_inicio, fecha_fin, estado, mensaje_solicitud, fecha_respuesta) VALUES
(1, 3, '2024-02-15', '2024-02-25', 'aceptada', 'Hola Ana, me interesa mucho tu proyecto de agricultura orgánica. Tengo experiencia en jardinería y quiero aprender más sobre permacultura. ¿Sería posible unirme a tu proyecto?', '2024-01-20 10:30:00'),
(2, 3, '2024-03-01', '2024-03-15', 'completada', 'Me encantaría ayudar enseñando inglés a los niños. Tengo experiencia como tutor y nivel C1 en inglés. He trabajado antes con niños en programas comunitarios.', '2024-02-10 14:15:00'),
(3, 3, '2024-04-01', '2024-04-21', 'pendiente', 'Hola María, soy artista y me fascinaría aprender técnicas de tejido tradicional. ¿Sería posible unirme a tu taller? Tengo algo de experiencia en manualidades.', NULL),
(4, 3, '2024-05-10', '2024-05-20', 'pendiente', 'Hola Juan, soy amante del trekking y me interesa tu propuesta. Tengo experiencia en montaña y primeros auxilios. ¿Podrías contarme más detalles?', NULL),
(1, 5, '2024-03-01', '2024-03-10', 'aceptada', 'Hola Ana, busco aprender sobre agricultura sostenible. Vivo en Huaraz pero puedo viajar a Cusco. ¿Tienes disponibilidad para esas fechas?', '2024-02-15 09:20:00');

-- Reseñas
INSERT INTO resenas (reserva_id, autor_id, destinatario_id, puntuacion, comentario) VALUES
(1, 3, 2, 5, 'Excelente experiencia! Ana es muy amable y el proyecto de agricultura es increíble. Aprendí mucho sobre cultivos orgánicos y la comunidad es maravillosa. Totalmente recomendado.'),
(2, 2, 3, 4, 'Carlos es un excelente profesor. Los niños lo adoraron y aprendieron mucho inglés. Muy responsable y comprometido con la comunidad. Esperamos tenerlo de vuelta pronto.'),
(5, 2, 5, 5, 'Juan fue un voluntario excepcional. Muy trabajador y aprendió rápido sobre agricultura orgánica. Definitivamente lo recibiríamos nuevamente en nuestra granja.');

-- Mensajes de ejemplo
INSERT INTO mensajes (remitente_id, destinatario_id, anuncio_id, contenido, estado, leido) VALUES
(3, 2, 1, 'Hola Ana, me interesa tu anuncio sobre la granja orgánica. ¿Podrías contarme más sobre las actividades diarias?','visto', 1),
(2, 3, 1, '¡Hola Carlos! Claro, normalmente trabajamos de 7am a 12pm en la granja, con descansos. Las tardes son libres para explorar la zona.','visto', 1),
(3, 2, 1, 'Suena perfecto. ¿Hay algún requisito especial de vestimenta o equipo que deba llevar?','enviado', 0),
(5, 4, 3, 'Hola María, tu taller de tejidos me parece fascinante. ¿Aceptan principiantes absolutos?','visto', 1),
(4, 5, 3, '¡Hola Juan! Sí, aceptamos principiantes. Lo importante es tener ganas de aprender y paciencia.','visto', 1);

-- Favoritos
INSERT INTO favoritos (usuario_id, anuncio_id, usuario_favorito_id, tipo) VALUES
(3, 1, NULL, 'anuncio'),
(3, NULL, 2, 'perfil'),
(3, 4, NULL, 'anuncio'),
(5, 1, NULL, 'anuncio'),
(5, NULL, 2, 'perfil'),
(2, NULL, 3, 'perfil');

-- Verificaciones de identidad
INSERT INTO verificaciones_identidad (usuario_id, tipo_documento, numero_documento, documento_archivo,verificaciones_identidad, estado, fecha_revision) VALUES
(2, 'dni', '71234567', '/public/uploads/verificaciones/ana-dni.jpg','/public/uploads/verificaciones/selfie-ana.jpg', 'verificado', '2024-01-15 14:30:00'),
(3, 'pasaporte', 'AB123456', '/public/uploads/verificaciones/carlos-pasaporte.jpg','/public/uploads/verificaciones/selfie-carlos.jpg', 'verificado', '2024-01-16 10:15:00'),
(4, 'dni', '76543210', '/public/uploads/verificaciones/maria-dni.jpg','/public/uploads/verificaciones/selfie-maria.jpg', 'pendiente', NULL);

-- Publicaciones en comunidad
INSERT INTO comunidad_publicaciones (autor_id, titulo, contenido, tipo, etiquetas) VALUES
(3, 'Mi experiencia increíble en Cusco', 'Acabo de pasar 2 semanas en la granja de Ana y fue transformador. Aprendí tanto sobre agricultura sostenible y la cultura local. Los atardeceres en el Valle Sagrado son mágicos. ¡Recomiendo totalmente esta experiencia!', 'experiencia', '["viaje", "agricultura", "cultura", "aprendizaje", "peru"]'),
(2, 'Buscamos voluntarios para temporada de cosecha', 'La temporada de cosecha se acerca y necesitamos manos extras. Es una gran oportunidad para aprender sobre agricultura orgánica mientras disfrutas de la belleza del Cusco. ¡Los esperamos!', 'evento', '["voluntariado", "cosecha", "oportunidad", "agricultura"]'),
(4, 'Taller abierto de tejidos este sábado', 'Este sábado tendremos taller abierto de tejidos tradicionales en Puno. Perfecto para viajeros que quieran aprender técnicas básicas. Materiales incluidos!', 'evento', '["taller", "artesania", "cultura", "puno"]');

-- Comentarios en publicaciones
INSERT INTO comunidad_comentarios (publicacion_id, autor_id, contenido) VALUES
(1, 2, '¡Qué alegría que hayas disfrutado tu estancia, Carlos! Eres siempre bienvenido de vuelta.'),
(1, 5, 'Suena increíble, Carlos. Estoy considerando ir en marzo. ¿Cómo es el clima en esa época?'),
(2, 3, '¡Me encantaría participar! ¿Para qué fechas exactamente necesitan ayuda?');

-- Notificaciones de ejemplo
INSERT INTO notificaciones (usuario_id, tipo, titulo, contenido, enlace, leido) VALUES
(2, 'solicitud', 'Nueva solicitud de reserva', 'Carlos López ha solicitado una reserva para tu anuncio "Ayuda en granja orgánica"', '/reservas', 1),
(3, 'reserva', 'Solicitud aceptada', 'Ana García ha aceptado tu solicitud para "Ayuda en granja orgánica"', '/reservas', 1),
(4, 'mensaje', 'Nuevo mensaje', 'Juan Martínez te ha enviado un mensaje', '/mensajes', 0);

-- Logs de auditoría
INSERT INTO logs_auditoria (usuario_id, accion, recurso, recurso_id, detalles, ip_address) VALUES
(1, 'login', 'sistema', NULL, '{"user_agent": "Mozilla/5.0..."}', '192.168.1.100'),
(3, 'crear_reserva', 'reservas', 1, '{"anuncio_id": 1, "fechas": "2024-02-15 al 2024-02-25"}', '192.168.1.105'),
(2, 'aceptar_reserva', 'reservas', 1, '{"estado_anterior": "pendiente", "estado_nuevo": "aceptada"}', '192.168.1.102');