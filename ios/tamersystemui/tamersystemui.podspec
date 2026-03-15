Pod::Spec.new do |s|
  s.name             = 'tamersystemui'
  s.version          = '0.1.0'
  s.summary          = 'System UI helpers for Lynx on iOS.'
  s.description      = 'Status bar, root background, and theme color helpers for Lynx apps on iOS.'
  s.homepage         = 'https://github.com/nanofuxion/tamer4lynx'
  s.license          = { :type => 'MIT' }
  s.author           = { 'Nanofuxion' => 'ramnadroj@gmail.com' }
  s.platform         = :ios, '13.0'
  s.source           = { :path => '.' }
  s.source_files     = 'tamersystemui/Classes/**/*.{swift,h}'
  s.dependency 'Lynx'
  s.swift_version    = '5.0'
end
