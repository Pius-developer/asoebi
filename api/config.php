<?php
declare(strict_types=1);

/*
 | Aso-ebi settings. Anything private goes in config.local.php (not on GitHub).
 */
$config = [
    'app_name'   => 'Aso-ebi',
    'app_url'    => getenv('ASOEBI_URL') ?: null,   // null = detect from the request
    'creator'    => 'Ejike Pius',
    'creator_x'  => 'ejike_pius',
    'github_url' => 'https://github.com/pius-developer/asoebi',
];

$local = dirname(__DIR__) . '/config.local.php';
if (is_file($local)) {
    $config = array_replace_recursive($config, require $local);
}
return $config;
