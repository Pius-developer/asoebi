<?php
declare(strict_types=1);

// Loaded by public_html/api/index.php, bin/ scripts and tests.
define('ROOT', dirname(__DIR__));
if (!defined('DB_PATH')) {
    define('DB_PATH', getenv('ASOEBI_DB') ?: ROOT . '/data/asoebi.sqlite');
}

$GLOBALS['config'] = require __DIR__ . '/config.php';
date_default_timezone_set('Africa/Lagos');

foreach (['Database', 'Util', 'Users', 'Events', 'Orders', 'Photo', 'Card', 'helpers'] as $f) {
    require __DIR__ . "/src/$f.php";
}
