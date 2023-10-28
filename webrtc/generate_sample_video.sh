ffmpeg -f lavfi -i testsrc=s=1280x720 -r 30  -filter_complex \
"nullsrc=s=1280x720,geq=random(1)/hypot(X-cos(N*0.17)*W/4-W/2\,Y-sin(N*0.19)*H/4-H/2)^2*5000000*sin(N*0.02):128:128" \
-t 3 -b:v 1500K out_complex.mp4

ffmpeg -i out_complex.mp4 -c:v mjpeg sample_video.mjpeg

rm out_complex.mp4
